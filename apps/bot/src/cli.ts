import { MeetBot } from "./meet-bot";

async function main() {
  const meetingUrl = process.argv[2];

  if (!meetingUrl) {
    console.error("❌ Masukkan URL rapat Google Meet!\n");
    console.error("Contoh penggunaan:");
    console.error("  pnpm --filter @kalam/bot join https://meet.google.com/abc-defg-hij\n");
    process.exit(1);
  }

  console.log("🤖 Menjalankan ruma. Meeting Bot (seperti tl;dv / Fathom / Otter)...");
  console.log(`🔗 Target: ${meetingUrl}\n`);

  const bot = new MeetBot({
    meetingUrl,
    botName: "ruma. Notulis (Al Akhyar)",
    headless: false, // Buka browser visual agar pengguna bisa melihat kehadiran bot
    onStatusChange: (status) => {
      console.log(`[BOT STATUS] ${status}`);
    },
    onTranscriptSegment: (pembicara, teks) => {
      console.log(`💬 [${pembicara}]: ${teks}`);
    },
  });

  process.on("SIGINT", async () => {
    console.log("\n🛑 Menerima sinyal berhenti, mengeluarkan bot dari rapat...");
    await bot.stop();
    process.exit(0);
  });

  await bot.start();
}

void main();
