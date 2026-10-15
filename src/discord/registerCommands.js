import { REST, Routes, SlashCommandBuilder } from "discord.js";

const PANEL = new SlashCommandBuilder()
  .setName("panel")
  .setDescription("ดูสถานะบอทที่คุณเป็นเจ้าของ (ใช้ใน DM เท่านั้น)")
  .toJSON();

/**
 * @param {string} token
 * @param {string} clientId
 */
export async function registerGlobalCommands(token, clientId) {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body: [PANEL] });
}
