import { LogoEveSvg } from "@vercel/geistdocs/assets/logos/logo-eve-svg";
import { ChevronRightIcon, MicIcon, PhoneOffIcon, TerminalIcon, WrenchIcon } from "lucide-react";
import { Lato } from "next/font/google";
import type { ReactNode } from "react";
import type {
  TemplateIntegration,
  TemplatePreview as TemplatePreviewData,
  TemplatePreviewMessage,
} from "@/lib/templates/manifest";
import { integrationIcons } from "./integration-icons";

/** Slack's UI typeface. Loaded only for the Slack preview. */
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  fallback: ["Helvetica Neue", "Helvetica", "Segoe UI", "Arial", "sans-serif"],
});

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
    return <IMessage agent={agent} icon={preview.icon} messages={preview.messages} />;
  }
  if (preview.surface === "slack") {
    return (
      <Slack
        agent={agent}
        channel={preview.context}
        icon={preview.icon}
        messages={preview.messages}
        user={pickPreviewUser(agent)}
      />
    );
  }
  if (preview.surface === "voice") {
    return <VoiceCall address={preview.context} messages={preview.messages} />;
  }
  return <WebChat address={preview.context} messages={preview.messages} />;
};

const Window = ({
  children,
  footer,
  header,
}: {
  children: ReactNode;
  footer?: ReactNode;
  header: ReactNode;
}) => (
  <div className="absolute top-5 -right-3 -bottom-5 left-6 overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100 text-[11.5px] leading-[1.35] text-gray-1000 shadow-sm">
    <div className="flex h-7 items-center gap-1.5 border-b border-gray-alpha-400 px-3 text-gray-800">
      {header}
    </div>
    <div className="flex flex-col gap-2 px-3 py-2.5">{children}</div>
    {footer}
  </div>
);

const BrowserBar = ({ address }: { address?: string }) => (
  <>
    <span className="size-1.5 rounded-full bg-gray-alpha-400" />
    <span className="size-1.5 rounded-full bg-gray-alpha-400" />
    <span className="size-1.5 rounded-full bg-gray-alpha-400" />
    {address ? <span className="ml-2 text-[10.5px]">{address}</span> : null}
  </>
);

const ChatMessages = ({ messages }: { messages: TemplatePreviewMessage[] }) =>
  messages.map((message) =>
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
  );

const WebChat = ({
  address,
  messages,
}: {
  address?: string;
  messages: TemplatePreviewMessage[];
}) => (
  <Window header={<BrowserBar address={address} />}>
    <ChatMessages messages={messages} />
  </Window>
);

/**
 * The eve Voice template's web app: a live transcript with tool calls in
 * place and its in-call controls (mute and a destructive "End call" button)
 * pinned to the visible bottom of the card.
 */
const VoiceCall = ({
  address,
  messages,
}: {
  address?: string;
  messages: TemplatePreviewMessage[];
}) => (
  <Window
    footer={
      <div className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-1.5 bg-linear-to-t from-background-100 from-60% to-transparent pt-4 pb-2">
        <span className="flex size-6 items-center justify-center rounded-md border border-gray-alpha-400 bg-background-100">
          <MicIcon className="size-3" />
        </span>
        <span className="flex h-6 items-center gap-1 rounded-md bg-red-800 px-2 font-medium text-[10.5px] text-white">
          <PhoneOffIcon className="size-3" />
          End call
        </span>
      </div>
    }
    header={<BrowserBar address={address} />}
  >
    <ChatMessages messages={messages} />
  </Window>
);

/** Mirrors the eve Web Chat `ToolHeader` for a completed, collapsed tool call. */
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

interface PreviewUser {
  name: string;
  /** GitHub user ID, for a rename-proof avatar URL. */
  githubId: number;
}

/** eve contributors who play the person talking to the agent. */
const PREVIEW_USERS: PreviewUser[] = [
  { name: "barba", githubId: 1316152 }, // AndrewBarba
  { name: "Casey Gowrie", githubId: 6045519 }, // ctgowrie
  { name: "pankow", githubId: 10215173 }, // benpankow
  { name: "owen", githubId: 22457492 }, // OwenKephart
  { name: "prha", githubId: 1040172 }, // prha
  { name: "chad", githubId: 183799 }, // chadhietala
  { name: "rui", githubId: 1834568 }, // ruiconti
  { name: "colton", githubId: 5807118 }, // cmpadden
  { name: "shar", githubId: 2982650 }, // darafsheh
];

/** Stable per template, so server and client render the same person. */
const pickPreviewUser = (seed: string): PreviewUser => {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PREVIEW_USERS[hash % PREVIEW_USERS.length]!;
};

const githubAvatar = (user: PreviewUser) =>
  `https://avatars.githubusercontent.com/u/${user.githubId}?s=72&v=4`;

const SLACK_TIMESTAMP = "10:42 AM";

/** The template's own icon when it has one, otherwise the eve logo on `fallbackClassName`. */
const AgentIcon = ({
  className,
  fallbackClassName,
  icon,
  logoHeight,
}: {
  className: string;
  fallbackClassName: string;
  icon?: string;
  logoHeight: number;
}) =>
  icon ? (
    // oxlint-disable-next-line nextjs/no-img-element -- tiny decorative avatar
    <img alt="" className={`${className} object-cover`} src={icon} />
  ) : (
    <span className={`${className} ${fallbackClassName} flex items-center justify-center`}>
      <LogoEveSvg height={logoHeight} />
    </span>
  );

/**
 * Laid out at Slack's real desktop metrics (Lato 15/22, 36px avatars, 8px 20px
 * message gutters, 49px channel header) and Slack's own light and dark
 * palette, then zoomed down as a whole so the proportions match Slack at any
 * card size.
 */
const Slack = ({
  agent,
  channel,
  icon,
  messages,
  user,
}: {
  agent: string;
  channel?: string;
  icon?: string;
  messages: TemplatePreviewMessage[];
  user: PreviewUser;
}) => (
  <div className="absolute top-3 -right-3 -bottom-5 left-6 overflow-hidden rounded-lg border border-gray-alpha-400 bg-white shadow-sm dark:bg-[#1a1d21]">
    <div
      className={`${lato.className} text-[15px] leading-[1.46668] text-[#1d1c1d] antialiased [zoom:0.72] dark:text-[#d1d2d3]`}
    >
      <div className="flex h-[49px] items-center border-b border-[rgba(29,28,29,0.13)] px-5 font-black text-[18px] leading-none dark:border-[#35373b] dark:text-[#f8f8f8]">
        <span className="mr-1 font-bold">#</span>
        {channel ?? "general"}
      </div>
      <div className="flex flex-col pt-2">
        {messages.map((message, index) => {
          const isAgent = message.from === "agent";
          // Slack folds a follow-up from the same sender under the first message's header.
          if (messages[index - 1]?.from === message.from) {
            return (
              <p className="-mt-2 break-words py-0.5 pr-5 pl-[64px]" key={message.text}>
                <Mentions text={message.text} />
              </p>
            );
          }
          return (
            <div className="flex gap-2 px-5 py-2" key={message.text}>
              {isAgent ? (
                <AgentIcon
                  className="size-9 shrink-0 rounded-lg"
                  fallbackClassName="bg-gray-1000 text-background-100"
                  icon={icon}
                  logoHeight={11}
                />
              ) : (
                // oxlint-disable-next-line nextjs/no-img-element -- tiny decorative avatar
                <img
                  alt=""
                  className="size-9 shrink-0 rounded-lg bg-[rgba(29,28,29,0.13)] object-cover"
                  src={githubAvatar(user)}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="font-black dark:text-[#f8f8f8]">
                    {isAgent ? agent : user.name}
                  </span>
                  {isAgent ? (
                    <span className="ml-1 self-center rounded-[2px] bg-[rgba(29,28,29,0.13)] px-[3px] py-px font-bold text-[10px] text-[rgba(29,28,29,0.7)] leading-[14px] dark:bg-[rgba(232,232,232,0.13)] dark:text-[#ababad]">
                      APP
                    </span>
                  ) : null}
                  <span className="ml-1 text-[#616061] text-[12px] dark:text-[#ababad]">
                    {SLACK_TIMESTAMP}
                  </span>
                </div>
                <p className="break-words">
                  <Mentions text={message.text} />
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

/** Slack's user mention: link blue on a 10% tint, 2px padding, 3px corners. */
const Mentions = ({ text }: { text: string }) =>
  text.split(/(@\w+)/).map((part, index) =>
    part.startsWith("@") ? (
      <span
        className="rounded-[3px] bg-[rgba(29,155,209,0.1)] px-0.5 text-[#1264a3] dark:bg-[rgba(29,155,209,0.18)] dark:text-[#1d9bd1]"
        key={`${index}${part}`}
      >
        {part}
      </span>
    ) : (
      part
    ),
  );

/** Liquid glass: translucent fill, blurred backdrop, a bright top edge, and a soft drop shadow. */
const GLASS =
  "bg-white/70 backdrop-blur-md backdrop-saturate-150 shadow-[0_2px_6px_rgba(0,0,0,0.08),inset_0_0.5px_0_rgba(255,255,255,0.9),inset_0_0_0_0.5px_rgba(0,0,0,0.06)] dark:bg-white/12 dark:shadow-[0_2px_6px_rgba(0,0,0,0.5),inset_0_0.5px_0_rgba(255,255,255,0.25),inset_0_0_0_0.5px_rgba(255,255,255,0.08)]";

// Bubble tails: a bubble-colored corner plus a screen-colored cutout that carves the curve.
const SENT_TAIL =
  "before:absolute before:bottom-0 before:-right-[5px] before:size-3.5 before:rounded-bl-[11px_10px] before:bg-inherit before:content-[''] after:absolute after:bottom-0 after:-right-[18px] after:h-3.5 after:w-[18px] after:rounded-bl-[7px] after:bg-background-100 after:content-['']";
const RECEIVED_TAIL =
  "before:absolute before:bottom-0 before:-left-[5px] before:size-3.5 before:rounded-br-[11px_10px] before:bg-inherit before:content-[''] after:absolute after:bottom-0 after:-left-[18px] after:h-3.5 after:w-[18px] after:rounded-br-[7px] after:bg-background-100 after:content-['']";

const IMessage = ({
  agent,
  icon,
  messages,
}: {
  agent: string;
  icon?: string;
  messages: TemplatePreviewMessage[];
}) => (
  <div className="absolute top-3 -bottom-10 left-1/2 w-64 -translate-x-1/2 overflow-hidden rounded-[30px] border border-gray-alpha-400 bg-background-100 text-[10.5px] leading-[1.3] text-gray-1000 shadow-sm">
    <div className="flex flex-col items-center pt-2.5">
      <span
        className={`absolute top-3.5 left-3 flex size-6 items-center justify-center rounded-full ${GLASS}`}
      >
        <svg aria-hidden="true" className="h-2.5" fill="none" viewBox="0 0 7 12">
          <path
            d="M6 1 1 6l5 5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
        </svg>
      </span>
      <AgentIcon
        className="relative z-10 size-8 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.18)] ring-[0.5px] ring-black/5 dark:ring-white/15"
        fallbackClassName="bg-linear-to-b from-[#a6abb8] to-[#858994] text-white"
        icon={icon}
        logoHeight={8}
      />
      <span className={`-mt-1 rounded-full px-2 py-0.5 font-semibold text-[9.5px] ${GLASS}`}>
        {agent}
        <span className="ml-0.5 font-normal text-[#8e8e93]">›</span>
      </span>
    </div>
    <div className="flex flex-col px-3.5 pt-2">
      {messages.map((message, index) => {
        const sent = message.from === "user";
        const next = messages[index + 1];
        const tail = !next || next.from !== message.from;
        return (
          <p
            className={[
              "relative max-w-[78%] rounded-[14px] px-2.5 py-[5px]",
              sent
                ? "self-end bg-[#0a84ff] text-white"
                : "self-start bg-[#e9e9eb] dark:bg-[#262628]",
              tail ? (sent ? SENT_TAIL : RECEIVED_TAIL) : "",
              tail && next ? "mb-1.5" : "mb-0.5",
            ].join(" ")}
            key={message.text}
          >
            {message.text}
          </p>
        );
      })}
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
