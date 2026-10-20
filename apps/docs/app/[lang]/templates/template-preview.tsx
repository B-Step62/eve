import { LogoEveSvg } from "@vercel/geistdocs/assets/logos/logo-eve-svg";
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
    return <IMessage agent={agent} icon={preview.icon} messages={preview.messages} />;
  }
  if (preview.surface === "slack") {
    return (
      <Slack
        agent={agent}
        channel={preview.context}
        icon={preview.icon}
        messages={preview.messages}
      />
    );
  }
  return <WebChat address={preview.context} messages={preview.messages} />;
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

const WebChat = ({
  address,
  messages,
}: {
  address?: string;
  messages: TemplatePreviewMessage[];
}) => (
  <Window
    header={
      <>
        <span className="size-1.5 rounded-full bg-gray-alpha-400" />
        <span className="size-1.5 rounded-full bg-gray-alpha-400" />
        <span className="size-1.5 rounded-full bg-gray-alpha-400" />
        {address ? <span className="ml-2 text-[10.5px]">{address}</span> : null}
      </>
    }
  >
    {messages.map((message) =>
      message.from === "user" ? (
        <p
          className="max-w-[78%] self-end rounded-xl rounded-br-sm bg-gray-1000 px-2.5 py-1.5 text-background-100"
          key={message.text}
        >
          {message.text}
        </p>
      ) : (
        <div className="flex max-w-[90%] flex-col gap-1.5" key={message.text}>
          <ToolCalls tools={message.tools} />
          <p>{message.text}</p>
        </div>
      ),
    )}
  </Window>
);

const SLACK_USER = "Alex";

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

const Slack = ({
  agent,
  channel,
  icon,
  messages,
}: {
  agent: string;
  channel?: string;
  icon?: string;
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
          {isAgent ? (
            <AgentIcon
              className="size-5.5 shrink-0 rounded-[5px]"
              fallbackClassName="bg-gray-1000 text-background-100"
              icon={icon}
              logoHeight={7}
            />
          ) : (
            <div className="flex size-5.5 shrink-0 items-center justify-center rounded-[5px] bg-purple-700 font-semibold text-[9.5px] text-white">
              {SLACK_USER[0]}
            </div>
          )}
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
  <div className="absolute top-4 -bottom-10 left-1/2 w-56 -translate-x-1/2 overflow-hidden rounded-[30px] border border-gray-alpha-400 bg-background-100 text-[11px] leading-[1.3] text-gray-1000 shadow-sm">
    <div className="flex flex-col items-center pt-3">
      <span
        className={`absolute top-4 left-3 flex size-6.5 items-center justify-center rounded-full ${GLASS}`}
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
        className="size-9 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.18)] ring-[0.5px] ring-black/5 dark:ring-white/15"
        fallbackClassName="bg-linear-to-b from-[#a6abb8] to-[#858994] text-white"
        icon={icon}
        logoHeight={9}
      />
      <span
        className={`relative -mt-1 rounded-full px-2 py-0.5 font-semibold text-[10px] ${GLASS}`}
      >
        {agent}
        <span className="ml-0.5 font-normal text-[#8e8e93]">›</span>
      </span>
    </div>
    <div className="flex flex-col px-3.5 pt-3">
      {messages.map((message, index) => {
        const sent = message.from === "user";
        const next = messages[index + 1];
        const tail = !next || next.from !== message.from;
        return (
          <p
            className={[
              "relative max-w-[78%] rounded-[15px] px-2.5 py-[5px]",
              sent
                ? "self-end bg-[#0a84ff] text-white"
                : "self-start bg-[#e9e9eb] dark:bg-[#262628]",
              tail ? (sent ? SENT_TAIL : RECEIVED_TAIL) : "",
              tail && next ? "mb-2" : "mb-0.5",
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
