import { ChannelType, EmbedBuilder } from "discord.js";
import {
  expiryFromStorage,
  formatDisplayDate,
  remainingText,
} from "../../core/expiry.js";
import { listBotsSorted } from "../../core/registry.js";
import { panelStatusForBot } from "../../core/botStatus.js";
import { formatBotRam } from "../../core/processMemory.js";

/**
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {object} state
 * @param {string | null} adminId
 */
export async function handlePanelCommand(interaction, state, adminId) {
  if (interaction.channel?.type !== ChannelType.DM) {
    await interaction.reply({
      content: "ใช้คำสั่ง `/panel` ใน **ข้อความส่วนตัว (DM)** กับบอท DeployBot เท่านั้น",
      ephemeral: true,
    });
    return;
  }

  const userId = interaction.user.id;
  const isAdmin = adminId != null && userId === adminId;
  let bots = listBotsSorted(state);

  if (isAdmin) {
    // all bots
  } else {
    bots = bots.filter((b) => b.ownerId === userId);
  }

  if (bots.length === 0) {
    await interaction.reply({
      content: isAdmin
        ? "ยังไม่มีบอทใน registry"
        : "ไม่พบบอทที่ผูก ownerId กับบัญชีของคุณ — ให้ admin ตั้ง `set bot=<id> ownerid=`",
    });
    return;
  }

  const embeds = bots.slice(0, 10).map((bot) => {
    const st = panelStatusForBot(bot);
    const exp = formatDisplayDate(expiryFromStorage(bot.expiryDate));
    const rem = remainingText(bot.expiryDate);
    const color =
      st.kind === "online" ? 0x57f287 : st.kind === "error" ? 0xed4245 : 0x95a5a6;

    return new EmbedBuilder()
      .setTitle(`#${bot.id} · ${bot.name}`)
      .setColor(color)
      .addFields(
        { name: "สถานะ", value: st.label, inline: true },
        { name: "PID", value: bot.pid != null ? String(bot.pid) : "-", inline: true },
        { name: "RAM", value: formatBotRam(bot), inline: true },
        { name: "Runtime", value: bot.runtime ?? "-", inline: true },
        { name: "หมดอายุ", value: exp, inline: true },
        { name: "เหลือ", value: rem, inline: true },
        {
          name: "Owner ID",
          value: bot.ownerId ?? "(ยังไม่ตั้ง)",
          inline: true,
        },
      );
  });

  const more =
    bots.length > 10 ? `\n_(แสดง 10 จาก ${bots.length} ตัว)_` : "";

  await interaction.reply({
    content: `**แผงสถานะ DeployBot**${more}`,
    embeds,
  });
}
