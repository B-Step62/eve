import { LogoEveSvg } from "@vercel/geistdocs/assets/logos/logo-eve-svg";
import { ArrowUpIcon, ChevronRightIcon, TerminalIcon, WrenchIcon } from "lucide-react";
import type { ReactNode } from "react";
import type {
  TemplateIntegration,
  TemplatePreview as TemplatePreviewData,
  TemplatePreviewMessage,
} from "@/lib/templates/manifest";
import { integrationIcons } from "./integration-icons";

interface TemplatePreviewProps {
  integrations: TemplateIntegration[];
  preview?: TemplatePreviewData;
  title: string;
}

/** Decorative card header: a sample conversation, or a placeholder built from integrations. */
export const TemplatePreview = ({ integrations, preview, title }: TemplatePreviewProps) => (
  <div
    aria-hidden="true"
    className="relative -mx-4 -mt-4 mb-4 h-44 overflow-hidden rounded-t-lg border-b border-gray-alpha-400 bg-background-200"
  >
    {preview ? (
      <Conversation agent={preview.agent ?? title} preview={preview} />
    ) : (
      <Placeholder integrations={integrations} />
    )}
  </div>
);

const Conversation = ({ agent, preview }: { agent: string; preview: TemplatePreviewData }) => {
  if (preview.surface === "imessage") {
    return <IMessage agent={agent} messages={preview.messages} />;
  }
  if (preview.surface === "slack") {
    return <Slack agent={agent} channel={preview.context} messages={preview.messages} />;
  }
  return <WebChat agent={agent} messages={preview.messages} />;
};

const Window = ({ children, header }: { children: ReactNode; header: ReactNode }) => (
  <div className="absolute top-5 -right-3 -bottom-5 left-6 overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100 text-[11.5px] leading-[1.35] text-gray-1000 shadow-sm">
    <div className="flex h-7 items-center gap-1.5 border-b border-gray-alpha-400 px-3 text-gray-800">
      {header}
    </div>
    <div className="flex flex-col gap-2 px-3 py-2.5">{children}</div>
  </div>
);

const ToolCalls = ({ tools }: { tools?: string[] }) =>
  tools && tools.length > 0 ? (
    <div className="flex flex-wrap gap-1.5">
      {tools.map((tool) => (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-gray-alpha-400 bg-gray-alpha-100 px-1.5 font-mono text-[10px] text-gray-900"
          key={tool}
        >
          <span className="text-green-700">✓</span>
          {tool}
        </span>
      ))}
    </div>
  ) : null;

/**
 * A scaled-down, static copy of the eve Web Chat registry UI
 * (`registry/channel/web`): centered agent-name header, primary user bubbles,
 * collapsed tool rows, and the floating rounded composer.
 */
const WebChat = ({ agent, messages }: { agent: string; messages: TemplatePreviewMessage[] }) => (
  <div className="absolute inset-x-5 top-5 -bottom-px flex flex-col overflow-hidden rounded-t-lg border border-gray-alpha-400 bg-background-200 text-[11.5px] leading-[1.4] text-gray-1000 shadow-sm">
    <div className="flex h-6 shrink-0 items-center justify-center px-10">
      <span className="truncate text-[10.5px] text-gray-900">{agent}</span>
    </div>
    <div className="flex flex-col gap-2 px-3.5">
      {messages.map((message) =>
        message.from === "user" ? (
          <p
            className="ml-auto w-fit max-w-[85%] rounded-xl bg-gray-1000 px-2.5 py-1.5 text-background-100"
            key={message.text}
          >
            {message.text}
          </p>
        ) : (
          <div className="flex flex-col gap-1" key={message.text}>
            {message.tools?.map((tool) => (
              <WebToolCall key={tool} name={tool} />
            ))}
            <p>{message.text}</p>
          </div>
        ),
      )}
    </div>
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background-200 to-transparent px-3.5 pt-2.5 pb-2">
      <div className="relative flex h-7 items-center rounded-xl border border-gray-alpha-400 bg-background-100 px-2.5 text-gray-700 shadow-sm">
        Send a message…
        <span className="absolute right-1 flex size-5 items-center justify-center rounded-full bg-gray-1000 text-background-100">
          <ArrowUpIcon className="size-3" />
        </span>
      </div>
    </div>
  </div>
);

/** Mirrors the Web Chat `ToolHeader` for a completed, collapsed tool call. */
const WebToolCall = ({ name }: { name: string }) => {
  const Icon = name === "bash" ? TerminalIcon : WrenchIcon;
  return (
    <span className="flex items-center gap-1.5 text-gray-900">
      <Icon className="size-3 shrink-0" />
      <span>{name}</span>
      <ChevronRightIcon className="size-2.5 shrink-0" />
    </span>
  );
};

const SLACK_USER = "Alex";

const Slack = ({
  agent,
  channel,
  messages,
}: {
  agent: string;
  channel?: string;
  messages: TemplatePreviewMessage[];
}) => (
  <Window
    header={
      <span className="font-medium text-gray-1000">
        <span className="font-normal text-gray-800"># </span>
        {channel ?? "general"}
      </span>
    }
  >
    {messages.map((message) => {
      const isAgent = message.from === "agent";
      return (
        <div className="flex gap-2" key={message.text}>
          <div
            className={
              isAgent
                ? "flex size-5.5 shrink-0 items-center justify-center rounded-[5px] bg-gray-1000 text-background-100"
                : "flex size-5.5 shrink-0 items-center justify-center rounded-[5px] bg-purple-700 font-semibold text-[9.5px] text-white"
            }
          >
            {isAgent ? <LogoEveSvg height={7} /> : SLACK_USER[0]}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className="font-semibold">{isAgent ? agent : SLACK_USER}</span>
              {isAgent ? (
                <span className="rounded-[3px] bg-gray-alpha-200 px-1 text-[9px] text-gray-900">
                  APP
                </span>
              ) : null}
            </div>
            <ToolCalls tools={message.tools} />
            <p>
              <Mentions text={message.text} />
            </p>
          </div>
        </div>
      );
    })}
  </Window>
);

const Mentions = ({ text }: { text: string }) =>
  text.split(/(@\w+)/).map((part, index) =>
    part.startsWith("@") ? (
      <span className="rounded-[3px] bg-blue-200 px-0.5 text-blue-900" key={`${index}${part}`}>
        {part}
      </span>
    ) : (
      part
    ),
  );

const IMessage = ({ agent, messages }: { agent: string; messages: TemplatePreviewMessage[] }) => (
  <div className="absolute top-4 -bottom-8 left-1/2 w-52 -translate-x-1/2 overflow-hidden rounded-[22px] border border-gray-alpha-400 bg-background-100 text-[11.5px] leading-[1.3] shadow-sm">
    <div className="flex flex-col items-center gap-0.5 border-b border-gray-alpha-400 py-1.5">
      <span className="flex size-5.5 items-center justify-center rounded-full bg-gray-1000 text-background-100">
        <LogoEveSvg height={7} />
      </span>
      <span className="text-[9.5px] text-gray-900">{agent}</span>
    </div>
    <div className="flex flex-col gap-1.5 px-2.5 py-2">
      {messages.map((message) =>
        message.from === "user" ? (
          <p
            className="max-w-[80%] self-end rounded-2xl bg-[#0a84ff] px-2.5 py-1.5 text-white"
            key={message.text}
          >
            {message.text}
          </p>
        ) : (
          <p
            className="max-w-[80%] self-start rounded-2xl bg-gray-alpha-200 px-2.5 py-1.5 text-gray-1000"
            key={message.text}
          >
            {message.text}
          </p>
        ),
      )}
    </div>
  </div>
);

const MAX_PLACEHOLDER_ICONS = 4;

const Placeholder = ({ integrations }: { integrations: TemplateIntegration[] }) => (
  <>
    <div className="absolute inset-0 bg-[radial-gradient(var(--color-gray-alpha-400)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)] bg-size-[14px_14px]" />
    <div className="absolute inset-0 flex items-center justify-center gap-2.5 px-4">
      <Tile>
        <LogoEveSvg height={14} />
      </Tile>
      <span className="text-gray-700">+</span>
      {integrations.slice(0, MAX_PLACEHOLDER_ICONS).map((integration) => {
        const Icon = integrationIcons[integration];
        return (
          <Tile key={integration}>
            <Icon className="size-5 grayscale" />
          </Tile>
        );
      })}
    </div>
  </>
);

const Tile = ({ children }: { children: ReactNode }) => (
  <div className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-[10px] border border-gray-alpha-400 bg-background-100 px-2.5 text-gray-1000">
    {children}
  </div>
);
