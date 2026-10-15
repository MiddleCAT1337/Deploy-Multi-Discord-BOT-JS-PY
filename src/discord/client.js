import { Client, Events, GatewayIntentBits } from "discord.js";
import { registerGlobalCommands } from "./registerCommands.js";
import { handlePanelCommand } from "./handlers/panel.js";

/**
 * @param {{ discordToken: string, adminId: string | null, state: object }} opts
 * @returns {Promise<{ client: Client, ready: boolean, error?: string }>}
 */
export async function startDiscordController({ discordToken, adminId, state }) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  let readyResolve;
  const readyPromise = new Promise((resolve) => {
    readyResolve = resolve;
  });

  client.once(Events.ClientReady, async (c) => {
    try {
      await registerGlobalCommands(discordToken, c.user.id);
    } catch (e) {
      readyResolve({
        client,
        ready: false,
        error: `slash register: ${e?.message ?? e}`,
      });
      return;
    }
    readyResolve({ client, ready: true });
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "panel") return;
    try {
      await handlePanelCommand(interaction, state, adminId);
    } catch (e) {
      const msg = e?.message ?? String(e);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `เกิดข้อผิดพลาด: ${msg}` }).catch(() => {});
      } else {
        await interaction.reply({ content: `เกิดข้อผิดพลาด: ${msg}` }).catch(() => {});
      }
    }
  });

  try {
    await client.login(discordToken);
  } catch (e) {
    return {
      client,
      ready: false,
      error: `login: ${e?.message ?? e}`,
    };
  }

  const result = await Promise.race([
    readyPromise,
    new Promise((resolve) =>
      setTimeout(
        () => resolve({ client, ready: false, error: "login timeout" }),
        30_000,
      ),
    ),
  ]);

  return result;
}

export async function stopDiscordController(client) {
  if (!client) return;
  try {
    client.destroy();
  } catch {}
}
