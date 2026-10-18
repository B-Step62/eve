import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = createRequire(require.resolve("@microsoft/api-extractor/package.json"))("typescript");
const root = fileURLToPath(new URL("../", import.meta.url));
const eve = join(root, "packages/eve");
const reports = join(eve, "public-api-shapes");
const allowlistPath = join(eve, "public-api-reachability.json");
const slash = (path) => path.replaceAll("\\", "/");

/** Declaration closures catch changes behind export aliases, not just renamed exports. */
export async function checkPublicApiShapes({ write = false, initialize = false } = {}) {
  const cache = join(eve, ".extension-contracts-cache");
  await mkdir(cache, { recursive: true });
  const temp = await mkdtemp(join(cache, "public-shapes-"));
  try {
    execFileSync(process.execPath, [join(eve, "scripts/vendor-compiled.mjs")], {
      cwd: eve,
      stdio: "pipe",
    });
    const manifest = JSON.parse(await readFile(join(eve, "package.json"), "utf8"));
    const declarations = join(temp, "declarations");
    execFileSync(
      process.execPath,
      [
        join(dirname(require.resolve("typescript/package.json")), "bin/tsc"),
        "-p",
        join(eve, "tsconfig.build.json"),
        "--outDir",
        declarations,
      ],
      { cwd: root, stdio: "pipe" },
    );
    await cp(join(eve, ".generated/compiled"), join(declarations, "src/compiled"), {
      recursive: true,
    });
    // Self-imports must resolve this emitted tree, never a stale workspace build.
    const staged = JSON.parse(JSON.stringify(manifest).replaceAll("./dist/", "./"));
    for (const target of Object.values(staged.imports)) delete target["eve-source"];
    for (const target of Object.values(staged.exports))
      if (typeof target === "object") delete target["eve-source"];
    await writeFile(join(declarations, "package.json"), JSON.stringify(staged));
    await symlink(join(eve, "node_modules"), join(declarations, "node_modules"), "junction");
    const entries = new Map();
    for (const [name, target] of Object.entries(manifest.exports)) {
      if (name.startsWith("./internal")) continue;
      if (typeof target !== "object" || !target.types?.endsWith(".d.ts")) continue;
      const declaration = target.types.replace(/^\.\/dist\//u, "");
      const source = join(declarations, declaration);
      if (name === "./workflow-modules")
        await cp(join(eve, "src/public/workflow-modules.d.ts"), source);
      entries.set(name === "." ? "eve" : `eve${name.slice(1)}`, source);
    }
    const program = ts.createProgram([...entries.values()], {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2024,
      skipLibCheck: true,
      strict: true,
      allowImportingTsExtensions: true,
      noEmit: true,
      types: ["node"],
    });
    const checker = program.getTypeChecker();
    const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
    const resolve = (symbol) =>
      symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const own = (symbol) =>
      symbol.declarations?.some((node) =>
        slash(node.getSourceFile().fileName).startsWith(slash(declarations) + "/"),
      );
    const identity = (symbol) =>
      `${slash(relative(declarations, symbol.declarations[0].getSourceFile().fileName))}#${symbol.name}`;
    const peerIdentity = (symbol) => {
      const file = slash(symbol.declarations?.[0]?.getSourceFile().fileName ?? "");
      const marker = "/node_modules/";
      return file.includes(marker)
        ? `${file.slice(file.lastIndexOf(marker) + marker.length)}#${symbol.name}`
        : symbol.name;
    };
    function closure(roots) {
      const peers = new Set();
      const symbols = new Set();
      const nodes = new Set();
      const pending = [...roots];
      while (pending.length) {
        const symbol = resolve(pending.pop());
        if (!symbol || symbols.has(symbol)) continue;
        if (!own(symbol)) {
          const peer = peerIdentity(symbol);
          if (peer.includes("/") && !peer.startsWith("typescript/lib/")) peers.add(peer);
          continue;
        }
        symbols.add(symbol);
        for (const declaration of symbol.declarations ?? []) {
          let node = declaration;
          if (ts.isVariableDeclaration(node)) node = node.parent.parent;
          if (node.parent !== node.getSourceFile() || nodes.has(node)) continue;
          nodes.add(node);
          function visit(child) {
            if (ts.isIdentifier(child)) {
              const reference = checker.getSymbolAtLocation(child);
              if (reference) pending.push(reference);
            }
            ts.forEachChild(child, visit);
          }
          ts.forEachChild(node, visit);
        }
      }
      return { symbols, nodes, peers };
    }
    const issues = [];
    const findings = { unexported: [], orphaned: [], any: [] };
    const expected = new Set();
    const entryExports = new Map();
    for (const [entry, path] of entries) {
      const source = program.getSourceFile(path);
      if (!source) throw new Error(`Missing declaration for ${entry}.`);
      const module = checker.getSymbolAtLocation(source);
      const exports = module
        ? checker.getExportsOfModule(module).map((symbol) => [symbol.name, resolve(symbol)])
        : source.statements.flatMap((statement) => {
            if (!ts.isModuleDeclaration(statement)) return [];
            const symbol = checker.getSymbolAtLocation(statement.name);
            return checker
              .getExportsOfModule(symbol)
              .map((member) => [`${statement.name.text}/${member.name}`, resolve(member)]);
          });
      entryExports.set(entry, exports);
    }
    const globallyExported = new Set(
      [...entryExports.values()].flatMap((exports) => exports.map(([, symbol]) => symbol)),
    );
    const isNamedType = (symbol) =>
      symbol.declarations?.some(
        (node) =>
          node.parent === node.getSourceFile() &&
          (ts.isInterfaceDeclaration(node) ||
            ts.isTypeAliasDeclaration(node) ||
            ts.isClassDeclaration(node) ||
            ts.isEnumDeclaration(node)),
      );
    for (const [entry, exports] of entryExports) {
      const source = program.getSourceFile(entries.get(entry));
      const exported = new Set(exports.map(([, symbol]) => symbol));
      const all = closure(exported);
      const fromValues = closure(
        [...exported].filter((symbol) => symbol.flags & ts.SymbolFlags.Value),
      );
      const lines = [
        `# ${entry}`,
        "",
        "## Export names",
        "",
        ...exports
          .map(
            ([name, symbol]) =>
              `- ${name}: ${own(symbol) ? identity(symbol) : "peer-owned " + peerIdentity(symbol)}`,
          )
          .sort(),
        "",
      ];
      lines.push("## Peer boundaries", "", ...[...all.peers].sort().map((peer) => `- ${peer}`), "");
      lines.push("## Declaration closure", "");
      const groups = new Map();
      for (const node of all.nodes) {
        const file = slash(relative(declarations, node.getSourceFile().fileName));
        const group = groups.get(file) ?? [];
        group.push(printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile()));
        groups.set(file, group);
      }
      for (const [file, nodes] of [...groups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        lines.push(`### ${file}`, "", "```ts", ...nodes.sort(), "```", "");
      }
      for (const symbol of all.symbols)
        if (isNamedType(symbol) && !globallyExported.has(symbol))
          findings.unexported.push(identity(symbol));
      for (const [name, symbol] of exports) {
        if (
          own(symbol) &&
          symbol.flags & ts.SymbolFlags.Type &&
          !(symbol.flags & ts.SymbolFlags.Value) &&
          !fromValues.symbols.has(symbol)
        )
          findings.orphaned.push(`${entry}: ${name}`);
        const type =
          symbol.flags & ts.SymbolFlags.Value
            ? checker.getTypeOfSymbolAtLocation(
                symbol,
                symbol.valueDeclaration ?? symbol.declarations?.[0] ?? source,
              )
            : checker.getDeclaredTypeOfSymbol(symbol);
        if (type.flags & ts.TypeFlags.Any) findings.any.push(`${entry}: ${name}`);
        for (const member of type.getProperties()) {
          if (!member.declarations?.length) continue;
          if (
            checker.getTypeOfSymbolAtLocation(member, member.declarations[0]).flags &
            ts.TypeFlags.Any
          )
            findings.any.push(`${entry}: ${name}.${member.name}`);
        }
      }
      const report = join(reports, `${entry}.api.md`);
      expected.add(report);
      const formatter = join(dirname(require.resolve("oxfmt/package.json")), "bin/oxfmt");
      const text = execFileSync(process.execPath, [formatter, "--stdin-filepath", report], {
        cwd: root,
        input: lines.join("\n"),
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      });
      if (write) {
        await mkdir(dirname(report), { recursive: true });
        await writeFile(report, text);
      } else if ((await readFile(report, "utf8").catch(() => "")) !== text)
        issues.push({
          file: slash(relative(root, report)),
          message:
            "Public declaration shape changed. Review and run node scripts/public-api-shapes.mjs --write.",
        });
    }
    for (const path of await readdir(reports, { recursive: true }).catch(() => [])) {
      const file = join(reports, path);
      if (path.endsWith(".api.md") && !expected.has(file)) {
        if (write) await rm(file);
        else
          issues.push({
            file: slash(relative(root, file)),
            message: "Retired public entry still has a shape report.",
          });
      }
    }
    for (const key of Object.keys(findings)) findings[key] = [...new Set(findings[key])].sort();
    const existing = await readFile(allowlistPath, "utf8").catch(() => undefined);
    if (initialize && existing === undefined)
      await writeFile(allowlistPath, JSON.stringify(findings, null, 2) + "\n");
    else if (existing === undefined)
      issues.push({
        file: slash(relative(root, allowlistPath)),
        message: "Initialize and review the public type allowlists.",
      });
    else {
      const allowlist = JSON.parse(existing);
      for (const key of Object.keys(findings)) {
        const allowed = new Set(allowlist[key]);
        for (const name of findings[key])
          if (!allowed.has(name))
            issues.push({
              file: slash(relative(root, allowlistPath)),
              message: `New ${key} public type finding: ${name}. Export author-written types or review an explicit intentional exception.`,
            });
        if (write && findings[key].every((name) => allowed.has(name)))
          allowlist[key] = findings[key];
      }
      if (write) await writeFile(allowlistPath, JSON.stringify(allowlist, null, 2) + "\n");
    }
    return issues;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const issues = await checkPublicApiShapes({
    write: process.argv.includes("--write"),
    initialize: process.argv.includes("--initialize-allowlists"),
  });
  for (const issue of issues) console.error(`${issue.file}: ${issue.message}`);
  if (issues.length) process.exitCode = 1;
  else console.log("[public-api:shapes] declaration closures and reviewed type findings match.");
}
