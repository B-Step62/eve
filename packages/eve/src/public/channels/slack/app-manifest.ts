import type { AppsManifestCreateArguments } from "@slack/web-api";

import type { JsonObject } from "#shared/json.js";
import type { SlackChannelConfig } from "#public/channels/slack/slackChannel.js";

const SLACK_APP_MANIFEST_TYPE = "https://docs.slack.dev/reference/app-manifest/";

interface SlackAppManifestBuildDefinition {
  readonly build: (channelName: string) => JsonObject;
}

type SlackManifest = AppsManifestCreateArguments["manifest"];
type SlackBotScope = NonNullable<
  NonNullable<NonNullable<SlackManifest["oauth_config"]>["scopes"]>["bot"]
>[number];
type SlackBotEvent = NonNullable<
  NonNullable<NonNullable<SlackManifest["settings"]>["event_subscriptions"]>["bot_events"]
>[number];

export function defineSlackAppManifest(
  input: Pick<
    SlackChannelConfig,
    "app" | "bot" | "scopes" | "optionalScopes" | "eventSubscriptions"
  >,
): SlackAppManifestBuildDefinition {
  return {
    build(channelName) {
      const name = (input.app?.name ?? channelName).slice(0, 35);
      const displayName =
        (input.bot?.displayName ?? channelName)
          .toLowerCase()
          .replace(/[^a-z0-9._-]+/g, "-")
          .slice(0, 35) || "eve";
      const required = new Set(["app_mentions:read", "chat:write", ...(input.scopes ?? [])]);
      const optional = [...new Set(input.optionalScopes ?? [])].filter(
        (scope) => !required.has(scope),
      );
      const scopes: { bot: SlackBotScope[]; bot_optional?: SlackBotScope[] } = {
        bot: [...required, ...optional] as SlackBotScope[],
      };
      if (optional.length) scopes.bot_optional = optional as SlackBotScope[];
      const displayInformation: {
        name: string;
        description?: string;
        background_color?: string;
      } = { name };
      if (input.app?.description !== undefined) {
        displayInformation.description = input.app.description;
      }
      if (input.app?.backgroundColor !== undefined) {
        displayInformation.background_color = input.app.backgroundColor;
      }
      const manifest = {
        $type: SLACK_APP_MANIFEST_TYPE,
        display_information: displayInformation,
        features: {
          app_home: {
            home_tab_enabled: false,
            messages_tab_enabled: true,
            messages_tab_read_only_enabled: false,
          },
          bot_user: { display_name: displayName },
        },
        oauth_config: { scopes },
        settings: {
          event_subscriptions: {
            bot_events: [
              ...new Set(["app_mention", ...(input.eventSubscriptions ?? [])]),
            ] as SlackBotEvent[],
          },
          org_deploy_enabled: false,
          socket_mode_enabled: false,
          token_rotation_enabled: false,
        },
      } satisfies AppsManifestCreateArguments["manifest"];
      return manifest;
    },
  };
}
