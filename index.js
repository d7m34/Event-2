// index.js
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  ComponentType
} = require('discord.js');
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const http = require('http');

const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'alive',
    bot: client.user ? client.user.tag : 'starting...',
    uptime: process.uptime(),
    guilds: client.guilds ? client.guilds.cache.size : 0
  }));
});

server.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

const DATA_PATH = path.join(__dirname, 'data.json');

const CONFIG = {
  PREFIX: '$',
  COLORS: {
    PRIMARY: 0x2B2D31,
    SUCCESS: 0x23A559,
    ERROR: 0xF23F43,
    WARNING: 0xF0B232,
    GAME: 0x5865F2,
    GOLD: 0xF1C40F,
    INFO: 0x5865F2,
    ACCENT: 0xEB459E
  },
  ROULETTE: {
    WIDTH: 600,
    HEIGHT: 600,
    SLICE_COLORS: [
      '#5865F2', '#EB459E', '#57F287', '#FEE75C', '#ED4245',
      '#9B59B6', '#E91E63', '#2ECC71', '#F39C12', '#E74C3C',
      '#3498DB', '#1ABC9C', '#E67E22', '#9B59B6', '#34495E',
      '#16A085', '#27AE60', '#2980B9', '#8E44AD', '#2C3E50',
      '#F1C40F', '#E74C3C', '#1ABC9C', '#3498DB', '#9B59B6',
      '#E91E63', '#2ECC71', '#F39C12', '#E74C3C', '#5865F2'
    ]
  },
  GAME_TIMER: 7,
  FOOTER: '⚡ تحدي الـ 7 ثواني',
  WINNER_ROLE_NAME: '🏆 فائز'
};

const DEFAULT_ALIASES = {
  game: ['game'],
  cancel: ['cancel'],
  setresult: ['setresult'],
  setlog: ['setlog'],
  settimer: ['settimer'],
  addchallenge: ['addchallenge'],
  removechallenge: ['removechallenge'],
  challenges: ['challenges'],
  leaderboard: ['leaderboard'],
  gamestats: ['gamestats'],
  admin: ['admin'],
  help: ['help'],
  addcmd: ['addcmd'],
  روح: ['روح']
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

function loadData() {
  try {
    if (!fs.existsSync(DATA_PATH)) { fs.writeFileSync(DATA_PATH, '{}'); return {}; }
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8') || '{}');
  } catch { return {}; }
}
function saveData(d) { fs.writeFileSync(DATA_PATH, JSON.stringify(d, null, 2)); }
function getGuild(id) {
  const d = loadData();
  if (!d[id]) {
    d[id] = {
      admins: [], owners: [], logChannelId: null, resultChannelId: null,
      challenges: [], usedChallenges: [],
      gameStats: { totalGames: 0, players: {} },
      activeGame: null, joinTimer: 60, gameTimer: CONFIG.GAME_TIMER,
      aliases: JSON.parse(JSON.stringify(DEFAULT_ALIASES))
    };
    saveData(d);
  }
  if (!d[id].joinTimer) d[id].joinTimer = 60;
  if (!d[id].gameTimer) d[id].gameTimer = CONFIG.GAME_TIMER;
  if (!d[id].challenges) d[id].challenges = [];
  if (!d[id].usedChallenges) d[id].usedChallenges = [];
  if (!d[id].aliases) d[id].aliases = JSON.parse(JSON.stringify(DEFAULT_ALIASES));
  return d[id];
}
function saveGuild(id, g) { const d = loadData(); d[id] = g; saveData(d); }
function isOwner(uid, g) { return uid === OWNER_ID || (g.owners && g.owners.includes(uid)); }
function isAdmin(uid, g) { return isOwner(uid, g) || (g.admins && g.admins.includes(uid)); }

function resolveCommand(inputCmd, guildData) {
  const aliases = guildData.aliases || DEFAULT_ALIASES;
  for (const [mainCmd, aliasList] of Object.entries(aliases)) {
    if (aliasList.includes(inputCmd)) return mainCmd;
  }
  return inputCmd;
}

function makeEmbed(author, desc, color = CONFIG.COLORS.PRIMARY) {
  const e = new EmbedBuilder().setAuthor({ name: author }).setColor(color).setTimestamp().setFooter({ text: CONFIG.FOOTER });
  if (desc) e.setDescription(desc);
  return e;
}

async function sendLog(guild, g, title, desc) {
  if (!g.logChannelId) return;
  try {
    const c = await guild.channels.fetch(g.logChannelId).catch(() => null);
    if (c) await c.send({ embeds: [makeEmbed(`📋 ${title}`, desc, CONFIG.COLORS.INFO)] });
  } catch {}
}

function truncName(n, m) { return n.length <= m ? n : n.substring(0, m - 1) + '…'; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function drawWheelFrame(names, rotation) {
  const W = CONFIG.ROULETTE.WIDTH, H = CONFIG.ROULETTE.HEIGHT;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const cx = W / 2, cy = H / 2, R = W / 2 - 50;
  const n = names.length;
  const sliceAngle = (2 * Math.PI) / n;
  let fontSize, maxLen;
  if (n <= 6) { fontSize = 22; maxLen = 16; }
  else if (n <= 10) { fontSize = 18; maxLen = 14; }
  else if (n <= 20) { fontSize = 14; maxLen = 10; }
  else if (n <= 40) { fontSize = 10; maxLen = 8; }
  else { fontSize = 8; maxLen = 6; }
  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.arc(cx, cy, R + 12, 0, Math.PI * 2);
  ctx.strokeStyle = '#5865F2';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#5865F2';
  ctx.shadowBlur = 15;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, 0, sliceAngle);
    ctx.closePath();
    ctx.fillStyle = CONFIG.ROULETTE.SLICE_COLORS[i % CONFIG.ROULETTE.SLICE_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    ctx.rotate(sliceAngle / 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(truncName(names[i], maxLen), R * 0.35, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.rotate(sliceAngle);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22);
  cGrad.addColorStop(0, '#FFFFFF');
  cGrad.addColorStop(1, '#CCCCCC');
  ctx.fillStyle = cGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 2;
  ctx.stroke();
  const arrowX = cx + R + 15;
  ctx.beginPath();
  ctx.moveTo(arrowX, cy);
  ctx.lineTo(arrowX + 25, cy - 15);
  ctx.lineTo(arrowX + 25, cy + 15);
  ctx.closePath();
  ctx.fillStyle = '#ED4245';
  ctx.shadowColor = '#ED4245';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#a5312e';
  ctx.lineWidth = 2;
  ctx.stroke();
  return { canvas, ctx };
}

async function spinWheel(channel, names, title) {
  const n = names.length;
  if (n === 0) return null;
  if (n === 1) return { name: names[0], index: 0 };
  const originalWinIdx = Math.floor(Math.random() * n);
  const winnerName = names[originalWinIdx];
  let reordered = [];
  for (let i = 0; i < n; i++) {
    if (i !== originalWinIdx) reordered.push(names[i]);
  }
  reordered.push(winnerName);
  reordered = reordered.reverse();
  const sliceAngle = (2 * Math.PI) / n;
  const targetAngle = sliceAngle / 2;
  const fullRotations = 3 + Math.floor(Math.random() * 2);
  const totalRotation = fullRotations * 2 * Math.PI + targetAngle;
  const steps = [0.1, 0.25, 0.45, 0.65, 0.82, 0.94, 1.0];
  const { canvas: firstCanvas } = drawWheelFrame(reordered, 0);
  const firstAtt = new AttachmentBuilder(firstCanvas.toBuffer('image/png'), { name: 'w.png' });
  const wheelMsg = await channel.send({ content: `**🎰 ${title}**`, files: [firstAtt] });
  for (const step of steps) {
    const easedT = easeOutCubic(step);
    const rot = totalRotation * easedT;
    const { canvas: sc } = drawWheelFrame(reordered, -rot);
    const sa = new AttachmentBuilder(sc.toBuffer('image/png'), { name: 'w.png' });
    const d = step < 0.3 ? 250 : step < 0.6 ? 350 : step < 0.9 ? 500 : 700;
    await new Promise(r => setTimeout(r, d));
    try { await wheelMsg.edit({ content: `**🎰 ${title}**`, files: [sa] }); } catch {}
  }
  const { canvas: fc } = drawWheelFrame(reordered, -totalRotation);
  const fa = new AttachmentBuilder(fc.toBuffer('image/png'), { name: 'w.png' });
  try {
    await wheelMsg.edit({
      content: `**🎰 ${title}**`,
      files: [fa],
      embeds: [new EmbedBuilder()
        .setAuthor({ name: `🎉 ${title}` })
        .setDescription(`\`\`\`\n★ ${winnerName} ★\n\`\`\``)
        .setColor(CONFIG.COLORS.SUCCESS)
        .setFooter({ text: CONFIG.FOOTER })
        .setTimestamp()
      ]
    });
  } catch {}
  return { name: winnerName, index: originalWinIdx };
}

function formatTimer(seconds) {
  if (seconds < 60) return `${seconds} ثانية`;
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return s > 0 ? `${m} دقيقة و ${s} ثانية` : `${m} دقيقة`;
}

// دالة للحصول على رول الفائز أو إنشائها
async function getOrCreateWinnerRole(guild) {
  let role = guild.roles.cache.find(r => r.name === CONFIG.WINNER_ROLE_NAME);
  if (!role) {
    try {
      role = await guild.roles.create({
        name: CONFIG.WINNER_ROLE_NAME,
        color: 0xF1C40F,
        reason: 'رول الفائز - تحدي الـ 7 ثواني'
      });
    } catch { return null; }
  }
  return role;
}

// دالة لتشغيل جولة واحدة بين لاعبين
async function playRound(message, gameChannel, botMember, guildData, player1, player2, selectedChallenge, gameTimer) {
  await gameChannel.send({
    embeds: [new EmbedBuilder().setAuthor({ name: '⚔️ المواجهة' }).setDescription(`\`\`\`\n${player1.displayName}  ⚡  ${player2.displayName}\n\`\`\``).setColor(CONFIG.COLORS.ACCENT).setFooter({ text: CONFIG.FOOTER })]
  });

  // فتح الشات للمزايدة
  try {
    await gameChannel.permissionOverwrites.set([
      { id: message.guild.id, deny: [PermissionsBitField.Flags.SendMessages] },
      { id: player1.id, allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel] },
      { id: player2.id, allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel] },
      { id: botMember.id, allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages] }
    ]);
    for (const aid of [...new Set([...(guildData.admins || []), ...(guildData.owners || []), OWNER_ID])]) {
      try { await gameChannel.permissionOverwrites.edit(aid, { SendMessages: true, ViewChannel: true }); } catch {}
    }
  } catch { return null; }

  await gameChannel.send({
    embeds: [new EmbedBuilder().setAuthor({ name: '🔨 بدأ المزاد الآن!' }).setDescription(
      `\`\`\`\n📋 التحدي: ${selectedChallenge}\n🎮 المدة: ${formatTimer(gameTimer)}\n\`\`\`\n⚡ **${player1.displayName}** و **${player2.displayName}**\n\n> زايدوا بالأرقام! كل رقم أعلى من السابق\n> لمن تبي توقف المزاد اكتب \`$روح @الخصم\``
    ).setColor(CONFIG.COLORS.GAME).setFooter({ text: CONFIG.FOOTER })]
  });

  let playerBids = {};
  playerBids[player1.id] = 0;
  playerBids[player2.id] = 0;
  let lastBid = 0;
  let auctionEnded = false;
  let auctionWinner = null;

  const bidCollector = gameChannel.createMessageCollector({
    filter: m => (m.author.id === player1.id || m.author.id === player2.id),
    time: 600000
  });

  bidCollector.on('collect', m => {
    if (auctionEnded) return;
    const num = parseInt(m.content.trim());
    if (!isNaN(num) && num > lastBid) {
      lastBid = num;
      playerBids[m.author.id] = num;
    }
  });

  const goCollector = gameChannel.createMessageCollector({
    filter: m => {
      if (m.author.id !== player1.id && m.author.id !== player2.id) return false;
      const content = m.content.trim();
      if (!content.startsWith(CONFIG.PREFIX)) return false;
      const cmdPart = content.slice(CONFIG.PREFIX.length).trim().split(/\s+/)[0]?.toLowerCase();
      const resolved = resolveCommand(cmdPart, guildData);
      return resolved === 'روح' && m.mentions.users.size > 0;
    },
    time: 600000
  });

  await new Promise((resolve) => {
    goCollector.on('collect', async (m) => {
      const mentioned = m.mentions.users.first();
      if (!mentioned) return;
      const senderId = m.author.id;
      const opponentId = senderId === player1.id ? player2.id : player1.id;
      if (mentioned.id !== opponentId) return;
      auctionEnded = true;
      auctionWinner = senderId;
      bidCollector.stop();
      goCollector.stop();
      try { await m.delete(); } catch {}
      resolve();
    });
    goCollector.on('end', () => {
      if (!auctionEnded) { auctionEnded = true; bidCollector.stop(); resolve(); }
    });
  });

  if (!auctionWinner) return null;

  const chosenPlayer = auctionWinner === player1.id ? player2 : player1;
  const opponent = auctionWinner === player1.id ? player1 : player2;
  const chosenBid = playerBids[chosenPlayer.id] || 0;
  lastBid = chosenBid;

  await gameChannel.send({
    embeds: [makeEmbed('⚡', `\`\`\`\n${chosenPlayer.displayName} سيعدد!\nالرقم المطلوب: ${chosenBid}\n\`\`\``, CONFIG.COLORS.SUCCESS)]
  });

  // إغلاق الشات
  try {
    await gameChannel.permissionOverwrites.set([
      { id: message.guild.id, deny: [PermissionsBitField.Flags.SendMessages] },
      { id: botMember.id, allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages] }
    ]);
    for (const aid of [...new Set([...(guildData.admins || []), ...(guildData.owners || []), OWNER_ID])]) {
      try { await gameChannel.permissionOverwrites.edit(aid, { SendMessages: true, ViewChannel: true }); } catch {}
    }
  } catch {}

  const readyRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ready_${chosenPlayer.id}`).setLabel('جاهز!').setStyle(ButtonStyle.Success).setEmoji('✅')
  );
  const readyMsg = await gameChannel.send({
    embeds: [new EmbedBuilder().setAuthor({ name: '⚡ استعد!' }).setDescription(
      `<@${chosenPlayer.id}>\n\`\`\`\n📋 التحدي: ${selectedChallenge}\n🔢 الرقم: ${lastBid}\n🎮 المدة: ${formatTimer(gameTimer)}\n\`\`\`\nاضغط **جاهز**`
    ).setColor(CONFIG.COLORS.WARNING).setFooter({ text: CONFIG.FOOTER })],
    components: [readyRow]
  });

  try {
    const readyInt = await readyMsg.awaitMessageComponent({ filter: i => i.customId === `ready_${chosenPlayer.id}` && i.user.id === chosenPlayer.id, time: 120000 });
    await readyInt.update({ embeds: [makeEmbed('✅', `\`\`\`\n${chosenPlayer.displayName} جاهز!\n\`\`\``, CONFIG.COLORS.SUCCESS)], components: [] });
  } catch {
    try { await gameChannel.permissionOverwrites.set([{ id: message.guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }]); } catch {}
    return null;
  }

  const countMsg = await gameChannel.send({ content: '```\n   3️⃣\n```' });
  await new Promise(r => setTimeout(r, 1000));
  await countMsg.edit({ content: '```\n   2️⃣\n```' });
  await new Promise(r => setTimeout(r, 1000));
  await countMsg.edit({ content: '```\n   1️⃣\n```' });
  await new Promise(r => setTimeout(r, 1000));

  try { await gameChannel.permissionOverwrites.edit(chosenPlayer.id, { SendMessages: true, ViewChannel: true }); } catch {}

  const timerMsg = await gameChannel.send({
    embeds: [new EmbedBuilder().setAuthor({ name: `⚡ ${chosenPlayer.displayName} — ابدأ!` }).setDescription(
      `\`\`\`\n📋 ${selectedChallenge}\n🔢 ${lastBid}\n⏱️ ${formatTimer(gameTimer)}\n\`\`\``
    ).setColor(CONFIG.COLORS.GAME).setFooter({ text: CONFIG.FOOTER })]
  });

  for (let t = gameTimer - 1; t >= 0; t--) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const color = t <= 3 ? CONFIG.COLORS.ERROR : t <= Math.floor(gameTimer / 3) ? CONFIG.COLORS.WARNING : CONFIG.COLORS.GAME;
      await timerMsg.edit({
        embeds: [new EmbedBuilder()
          .setAuthor({ name: t === 0 ? '⏰ انتهى الوقت!' : `⚡ ${chosenPlayer.displayName}` })
          .setDescription(t === 0 ? '```\n⏰ انتهى!\n```' : `\`\`\`\n📋 ${selectedChallenge}\n🔢 ${lastBid}\n⏱️ ${formatTimer(t)}\n\`\`\``)
          .setColor(color).setFooter({ text: CONFIG.FOOTER })]
      });
    } catch {}
  }

  try { await gameChannel.permissionOverwrites.edit(chosenPlayer.id, { SendMessages: false }); } catch {}

  // إرجاع البيانات للتقييم
  return { chosenPlayer, opponent, selectedChallenge, lastBid, gameTimer };
}

async function handleGame(message, guildData) {
  if (!isAdmin(message.author.id, guildData)) return;
  if (guildData.activeGame) return message.reply({ embeds: [makeEmbed('❌', '`$cancel` لإلغاء الحالية.', CONFIG.COLORS.ERROR)] });
  if (!guildData.resultChannelId) return message.reply({ embeds: [makeEmbed('❌', '`$setresult #الروم` أولاً.', CONFIG.COLORS.ERROR)] });
  const allChallenges = guildData.challenges || [];
  if (!allChallenges.length) return message.reply({ embeds: [makeEmbed('❌', '`$addchallenge` أولاً.', CONFIG.COLORS.ERROR)] });

  const gameChannel = message.channel;
  const botMember = await message.guild.members.fetchMe();
  if (!gameChannel.permissionsFor(botMember).has([PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.ManageRoles]))
    return message.reply({ embeds: [makeEmbed('❌', 'البوت يحتاج **إدارة القنوات** و **إدارة الرسائل** و **إدارة الأدوار**.', CONFIG.COLORS.ERROR)] });

  try { await message.delete(); } catch {}

  let bannerURL = null;
  try { const g = await message.guild.fetch(); bannerURL = g.bannerURL({ size: 1024 }) || g.iconURL({ size: 1024 }) || null; } catch {}

  const participants = new Set();
  const joinTimer = guildData.joinTimer || 60;
  const gameTimer = guildData.gameTimer || CONFIG.GAME_TIMER;

  const joinEmbed = new EmbedBuilder()
    .setAuthor({ name: '⚡ تحدي الـ 7 ثواني' })
    .setDescription(`\`\`\`\n🏆 مستعد للتحدي؟ انضم الآن!\n\`\`\`\n**المسجلين:** 0\n**⏱️ يغلق خلال:** ${formatTimer(joinTimer)}\n**🎮 مدة التحدي:** ${formatTimer(gameTimer)}`)
    .setColor(CONFIG.COLORS.GAME).setFooter({ text: CONFIG.FOOTER }).setTimestamp();
  if (bannerURL) joinEmbed.setImage(bannerURL);

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('g_join').setLabel('انضمام').setStyle(ButtonStyle.Secondary).setEmoji('⚡'),
    new ButtonBuilder().setCustomId('g_leave').setLabel('خروج').setStyle(ButtonStyle.Secondary).setEmoji('🚪'),
    new ButtonBuilder().setCustomId('g_start').setLabel('بدء').setStyle(ButtonStyle.Success).setEmoji('🚀')
  );

  const joinMsg = await gameChannel.send({ embeds: [joinEmbed], components: [joinRow] });
  guildData.activeGame = { phase: 'joining', channelId: gameChannel.id, startedBy: message.author.id };
  saveGuild(message.guild.id, guildData);

  let started = false, remaining = joinTimer;
  const timerInterval = setInterval(async () => {
    remaining--;
    if (remaining <= 0) { clearInterval(timerInterval); return; }
    if (remaining % 10 === 0 || remaining <= 5) {
      try {
        const u = EmbedBuilder.from(joinEmbed).setDescription(`\`\`\`\n🏆 مستعد للتحدي؟ انضم الآن!\n\`\`\`\n**المسجلين:** ${participants.size}\n**⏱️ يغلق خلال:** ${formatTimer(remaining)}\n**🎮 مدة التحدي:** ${formatTimer(gameTimer)}`);
        await joinMsg.edit({ embeds: [u] }).catch(() => {});
      } catch {}
    }
  }, 1000);

  const collector = joinMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: joinTimer * 1000 });

  collector.on('collect', async (i) => {
    if (i.customId === 'g_join') {
      if (i.user.bot) return i.deferUpdate();
      participants.add(i.user.id);
      const u = EmbedBuilder.from(joinEmbed).setDescription(`\`\`\`\n🏆 مستعد للتحدي؟ انضم الآن!\n\`\`\`\n**المسجلين:** ${participants.size}\n**⏱️ يغلق خلال:** ${formatTimer(remaining)}\n**🎮 مدة التحدي:** ${formatTimer(gameTimer)}`);
      await joinMsg.edit({ embeds: [u] }).catch(() => {});
      await i.reply({ content: `⚡ تم! (${participants.size})`, flags: 64 });
    }
    if (i.customId === 'g_leave') {
      participants.delete(i.user.id);
      const u = EmbedBuilder.from(joinEmbed).setDescription(`\`\`\`\n🏆 مستعد للتحدي؟ انضم الآن!\n\`\`\`\n**المسجلين:** ${participants.size}\n**⏱️ يغلق خلال:** ${formatTimer(remaining)}\n**🎮 مدة التحدي:** ${formatTimer(gameTimer)}`);
      await joinMsg.edit({ embeds: [u] }).catch(() => {});
      await i.reply({ content: '🚪 تم.', flags: 64 });
    }
    if (i.customId === 'g_start') {
      if (!isAdmin(i.user.id, guildData)) return i.reply({ content: '❌', flags: 64 });
      if (participants.size < 2) return i.reply({ content: '❌ 2 لاعبين على الأقل.', flags: 64 });
      started = true; clearInterval(timerInterval); collector.stop(); await i.deferUpdate();
    }
  });

  await new Promise(resolve => collector.on('end', () => resolve()));
  clearInterval(timerInterval);
  await joinMsg.edit({ components: [] }).catch(() => {});

  if (!started && participants.size >= 2) started = true;
  if (!started || participants.size < 2) {
    guildData.activeGame = null; saveGuild(message.guild.id, guildData);
    return gameChannel.send({ embeds: [makeEmbed('❌', 'لم يكتمل العدد.', CONFIG.COLORS.ERROR)] });
  }

  const playerIds = [...participants];
  let playerNames = [], playerMembers = [];
  for (const id of playerIds) {
    try { const m = await message.guild.members.fetch(id); playerNames.push(m.displayName); playerMembers.push(m); } catch {}
  }
  if (playerMembers.length < 2) {
    guildData.activeGame = null; saveGuild(message.guild.id, guildData);
    return gameChannel.send({ embeds: [makeEmbed('❌', 'عدد غير كافي.', CONFIG.COLORS.ERROR)] });
  }

  guildData.activeGame.phase = 'roulette1'; saveGuild(message.guild.id, guildData);

  // حلقة الجولات — كل جولة لاعبين يطلعون والفائز ياخذ رول
  let remainingNames = [...playerNames];
  let remainingMembers = [...playerMembers];
  let roundNum = 0;

  while (remainingMembers.length >= 2) {
    roundNum++;

    if (remainingMembers.length > 2) {
      await gameChannel.send({
        embeds: [makeEmbed('🏟️', `\`\`\`\nالجولة ${roundNum} — المتبقين: ${remainingMembers.length}\n\`\`\`\n${remainingMembers.map(m => `⚡ ${m.displayName}`).join('\n')}`, CONFIG.COLORS.GAME)]
      });
    }

    // روليت اللاعب الأول
    const r1 = await spinWheel(gameChannel, remainingNames, 'اختيار اللاعب الأول');
    if (!r1) { guildData.activeGame = null; saveGuild(message.guild.id, guildData); return; }
    const player1 = remainingMembers[r1.index];

    await gameChannel.send({
      embeds: [new EmbedBuilder().setAuthor({ name: '⚡ اللاعب الأول' }).setDescription(`\`\`\`\n${player1.displayName}\n\`\`\``).setThumbnail(player1.user.displayAvatarURL({ size: 128 })).setColor(CONFIG.COLORS.SUCCESS).setFooter({ text: CONFIG.FOOTER })]
    });

    // روليت اللاعب الثاني
    const rem = remainingNames.filter((_, i) => i !== r1.index);
    const remM = remainingMembers.filter((_, i) => i !== r1.index);

    const r2 = await spinWheel(gameChannel, rem, 'اختيار اللاعب الثاني');
    if (!r2) { guildData.activeGame = null; saveGuild(message.guild.id, guildData); return; }
    const player2 = remM[r2.index];

    await gameChannel.send({
      embeds: [new EmbedBuilder().setAuthor({ name: '⚡ اللاعب الثاني' }).setDescription(`\`\`\`\n${player2.displayName}\n\`\`\``).setThumbnail(player2.user.displayAvatarURL({ size: 128 })).setColor(CONFIG.COLORS.SUCCESS).setFooter({ text: CONFIG.FOOTER })]
    });

    // اختيار التحدي
    if (!guildData.usedChallenges) guildData.usedChallenges = [];
    let available = allChallenges.filter(c => !guildData.usedChallenges.includes(c));
    if (!available.length) {
      guildData.usedChallenges = [];
      available = [...allChallenges];
      saveGuild(message.guild.id, guildData);
      await gameChannel.send({ content: '```\n🔄 تم إعادة تعيين التحديات\n```' });
    }

    const cr = await spinWheel(gameChannel, available, 'اختيار التحدي');
    if (!cr) { guildData.activeGame = null; saveGuild(message.guild.id, guildData); return; }

    const selectedChallenge = cr.name;
    guildData.activeGame.challenge = selectedChallenge;
    guildData.usedChallenges.push(selectedChallenge);
    guildData.activeGame.phase = 'auction'; saveGuild(message.guild.id, guildData);

    // تشغيل الجولة
    const roundResult = await playRound(message, gameChannel, botMember, guildData, player1, player2, selectedChallenge, gameTimer);

    if (!roundResult) {
      guildData = getGuild(message.guild.id);
      guildData.activeGame = null; saveGuild(message.guild.id, guildData);
      try { await gameChannel.permissionOverwrites.set([{ id: message.guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }]); } catch {}
      return gameChannel.send({ embeds: [makeEmbed('❌', 'انتهت الجولة بدون نتيجة.', CONFIG.COLORS.ERROR)] });
    }

    // انتظار التقييم من الأدمن
    guildData = getGuild(message.guild.id);
    if (!guildData.activeGame) return;
    guildData.activeGame.phase = 'waiting';
    guildData.activeGame.roundPlayers = { chosen: roundResult.chosenPlayer.id, opponent: roundResult.opponent.id };
    saveGuild(message.guild.id, guildData);

    const resultChannel = await message.guild.channels.fetch(guildData.resultChannelId).catch(() => null);
    if (!resultChannel) { guildData.activeGame = null; saveGuild(message.guild.id, guildData); return; }

    const resultRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rnd_pass_${roundResult.chosenPlayer.id}_${roundResult.opponent.id}`).setLabel('نجح').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId(`rnd_fail_${roundResult.chosenPlayer.id}_${roundResult.opponent.id}`).setLabel('فشل').setStyle(ButtonStyle.Danger).setEmoji('❌')
    );
    const resultMsg = await resultChannel.send({
      embeds: [new EmbedBuilder().setAuthor({ name: `📊 تقييم — الجولة ${roundNum}` }).setDescription(
        `\`\`\`\n📋 ${selectedChallenge}\n🔢 ${roundResult.lastBid}\n🎮 ${formatTimer(gameTimer)}\n\`\`\`\n⚡ **المتحدي:** ${roundResult.chosenPlayer}\n👤 **الخصم:** ${roundResult.opponent}\n\n👥 **المتبقين:** ${remainingMembers.length}`
      ).setColor(CONFIG.COLORS.WARNING).setFooter({ text: CONFIG.FOOTER }).setTimestamp()],
      components: [resultRow]
    });

    // انتظار رد الأدمن على هذه الجولة
    let winnerId, loserId, passed;
    try {
      const resInt = await resultMsg.awaitMessageComponent({
        filter: i => (i.customId.startsWith('rnd_pass_') || i.customId.startsWith('rnd_fail_')) && isAdmin(i.user.id, guildData),
        time: 600000
      });

      const resParts = resInt.customId.split('_');
      passed = resParts[1] === 'pass';
      const chosenId = resParts[2], oppId = resParts[3];
      winnerId = passed ? chosenId : oppId;
      loserId = passed ? oppId : chosenId;

      await resInt.update({ embeds: [makeEmbed('✅', `${passed ? '✅ نجح' : '❌ فشل'} — 🏆 <@${winnerId}>`, passed ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.ERROR)], components: [] });
    } catch {
      guildData = getGuild(message.guild.id);
      guildData.activeGame = null; saveGuild(message.guild.id, guildData);
      try { await gameChannel.permissionOverwrites.set([{ id: message.guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }]); } catch {}
      return gameChannel.send({ embeds: [makeEmbed('❌', 'انتهى وقت التقييم.', CONFIG.COLORS.ERROR)] });
    }

    // تحديث الإحصائيات
    guildData = getGuild(message.guild.id);
    if (!guildData.gameStats) guildData.gameStats = { totalGames: 0, players: {} };
    guildData.gameStats.totalGames++;
    for (const id of [winnerId, loserId]) { if (!guildData.gameStats.players[id]) guildData.gameStats.players[id] = { wins: 0, losses: 0, games: 0 }; guildData.gameStats.players[id].games++; }
    guildData.gameStats.players[winnerId].wins++;
    guildData.gameStats.players[loserId].losses++;
    saveGuild(message.guild.id, guildData);

    // إعطاء رول الفائز
    const winnerRole = await getOrCreateWinnerRole(message.guild);
    const winnerMember = winnerId === player1.id ? player1 : player2;
    const loserMember = loserId === player1.id ? player1 : player2;

    if (winnerRole) {
      try { await winnerMember.roles.add(winnerRole); } catch {}
    }

    // إعلان النتيجة في روم اللعب
    await gameChannel.send({
      embeds: [new EmbedBuilder().setAuthor({ name: passed ? '✅ اجتاز!' : '❌ لم يجتز' }).setDescription(
        `\`\`\`\n📋 ${selectedChallenge}\n\`\`\`\n🏆 <@${winnerId}> ${winnerRole ? `— حصل على ${winnerRole}` : ''}\n💀 <@${loserId}>`
      ).setColor(passed ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.ERROR).setFooter({ text: CONFIG.FOOTER }).setTimestamp()]
    });

    await sendLog(message.guild, guildData, 'نتيجة', `الجولة ${roundNum} — ${selectedChallenge} — <@${winnerId}>`);

    // إخراج اللاعبين من الروليت
    const p1idx = remainingMembers.indexOf(player1);
    const p2idx = remainingMembers.indexOf(player2);
    // نحذف من الأكبر أولاً عشان ما يتغير الإندكس
    const toRemove = [p1idx, p2idx].sort((a, b) => b - a);
    for (const idx of toRemove) {
      if (idx !== -1) {
        remainingNames.splice(idx, 1);
        remainingMembers.splice(idx, 1);
      }
    }

    // لو باقي لاعبين أكثر من 1، نكمل
    if (remainingMembers.length >= 2) {
      await gameChannel.send({
        embeds: [makeEmbed('🔄', `\`\`\`\nالجولة القادمة — المتبقين: ${remainingMembers.length}\n\`\`\``, CONFIG.COLORS.GAME)]
      });
    }
  }

  // انتهت كل الجولات
  guildData = getGuild(message.guild.id);
  guildData.activeGame = null; saveGuild(message.guild.id, guildData);

  try { await gameChannel.permissionOverwrites.set([{ id: message.guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }]); } catch {}

  // لو باقي لاعب واحد (فردي) ما لعب
  if (remainingMembers.length === 1) {
    const lastPlayer = remainingMembers[0];
    const winnerRole = await getOrCreateWinnerRole(message.guild);
    if (winnerRole) { try { await lastPlayer.roles.add(winnerRole); } catch {} }
    await gameChannel.send({
      embeds: [makeEmbed('🏆', `\`\`\`\n${lastPlayer.displayName} فاز تلقائياً — ما لقى خصم!\n\`\`\`\n${winnerRole ? `حصل على ${winnerRole}` : ''}`, CONFIG.COLORS.GOLD)]
    });
  }

  await gameChannel.send({
    embeds: [makeEmbed('🎉', '```\nانتهت جميع الجولات!\n```', CONFIG.COLORS.GOLD)]
  });
}

client.on('interactionCreate', async (interaction) => {
  // نتجاهل أزرار rnd_ لأنها تُعالج في handleGame
  if (!interaction.isButton()) return;
  if (interaction.customId.startsWith('rnd_')) return;
  if (!interaction.customId.startsWith('res_')) return;

  const parts = interaction.customId.split('_');
  const action = parts[1], playerId = parts[2], opponentId = parts[3], guildId = parts[4];
  const guildData = getGuild(guildId);
  if (!isAdmin(interaction.user.id, guildData)) return interaction.reply({ content: '❌', flags: 64 });

  const passed = action === 'pass';
  const winnerId = passed ? playerId : opponentId, loserId = passed ? opponentId : playerId;
  if (!guildData.gameStats) guildData.gameStats = { totalGames: 0, players: {} };
  guildData.gameStats.totalGames++;
  for (const id of [winnerId, loserId]) { if (!guildData.gameStats.players[id]) guildData.gameStats.players[id] = { wins: 0, losses: 0, games: 0 }; guildData.gameStats.players[id].games++; }
  guildData.gameStats.players[winnerId].wins++; guildData.gameStats.players[loserId].losses++;

  const chName = guildData.activeGame?.challenge || '—';
  const gameCh = guildData.activeGame?.channelId ? await interaction.guild.channels.fetch(guildData.activeGame.channelId).catch(() => null) : null;
  if (gameCh) {
    try { await gameCh.permissionOverwrites.set([{ id: interaction.guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }]); } catch {}
    await gameCh.send({
      embeds: [new EmbedBuilder().setAuthor({ name: passed ? '✅ اجتاز!' : '❌ لم يجتز' }).setDescription(
        `\`\`\`\n📋 ${chName}\n\`\`\`\n🏆 <@${winnerId}>\n💀 <@${loserId}>`
      ).setColor(passed ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.ERROR).setFooter({ text: CONFIG.FOOTER }).setTimestamp()]
    });
  }
  guildData.activeGame = null; saveGuild(guildId, guildData);
  await interaction.update({ embeds: [makeEmbed('✅', `${passed ? '✅' : '❌'} 🏆 <@${winnerId}>`, passed ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.ERROR)], components: [] });
  await sendLog(interaction.guild, guildData, 'نتيجة', `${chName} — <@${winnerId}>`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(CONFIG.PREFIX)) return;

  const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/\s+/);
  const rawCmd = args[0]?.toLowerCase();
  let guildData = getGuild(message.guild.id);
  const cmd = resolveCommand(rawCmd, guildData);

  if (cmd === 'روح') return;

  try {
    switch (cmd) {
      case 'game': { await handleGame(message, guildData); break; }

      case 'cancel': {
        if (!isAdmin(message.author.id, guildData)) return;
        if (!guildData.activeGame) return message.reply({ embeds: [makeEmbed('❌', 'لا فعالية.', CONFIG.COLORS.ERROR)] });
        try { const ch = await message.guild.channels.fetch(guildData.activeGame.channelId).catch(() => null); if (ch) await ch.permissionOverwrites.set([{ id: message.guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }]).catch(() => {}); } catch {}
        guildData.activeGame = null; saveGuild(message.guild.id, guildData);
        await message.reply({ embeds: [makeEmbed('✅', '```\nتم الإلغاء\n```', CONFIG.COLORS.SUCCESS)] });
        break;
      }

      case 'setresult': {
        if (!isOwner(message.author.id, guildData)) return;
        const ch = message.mentions.channels.first() || message.channel;
        guildData.resultChannelId = ch.id; saveGuild(message.guild.id, guildData);
        const r = await message.reply({ embeds: [makeEmbed('✅', `النتائج: ${ch}`, CONFIG.COLORS.SUCCESS)] });
        try { await message.delete(); } catch {} setTimeout(() => r.delete().catch(() => {}), 5000);
        break;
      }

      case 'setlog': {
        if (!isOwner(message.author.id, guildData)) return;
        const ch = message.mentions.channels.first() || message.channel;
        guildData.logChannelId = ch.id; saveGuild(message.guild.id, guildData);
        const r = await message.reply({ embeds: [makeEmbed('✅', `السجل: ${ch}`, CONFIG.COLORS.SUCCESS)] });
        try { await message.delete(); } catch {} setTimeout(() => r.delete().catch(() => {}), 5000);
        break;
      }

      case 'settimer': {
        if (!isAdmin(message.author.id, guildData)) return;
        const ttId = `tt_${Date.now()}`;
        const ts = new StringSelectMenuBuilder().setCustomId(ttId).setPlaceholder('نوع التايمر...').addOptions([
          { label: '⏱️ تايمر التسجيل', value: 'join', description: `الحالي: ${formatTimer(guildData.joinTimer || 60)}` },
          { label: '🎮 تايمر اللعب', value: 'game', description: `الحالي: ${formatTimer(guildData.gameTimer || CONFIG.GAME_TIMER)}` }
        ]);
        const tMsg = await message.channel.send({ embeds: [makeEmbed('⏱️', '```\nاختر التايمر\n```', CONFIG.COLORS.WARNING)], components: [new ActionRowBuilder().addComponents(ts)] });
        try {
          const tI = await tMsg.awaitMessageComponent({ filter: i => i.customId === ttId && i.user.id === message.author.id, time: 20000 });
          const type = tI.values[0];
          const tvId = `tv_${Date.now()}`;
          const opts = [
            { label: '5 ثواني', value: '5' }, { label: '7 ثواني', value: '7' }, { label: '10 ثواني', value: '10' },
            { label: '15 ثانية', value: '15' }, { label: '20 ثانية', value: '20' }, { label: '30 ثانية', value: '30' },
            { label: '45 ثانية', value: '45' }, { label: '1 دقيقة', value: '60' }, { label: '1.5 دقيقة', value: '90' },
            { label: '2 دقيقة', value: '120' }, { label: '3 دقائق', value: '180' }, { label: '5 دقائق', value: '300' },
            { label: '10 دقائق', value: '600' }, { label: '15 دقيقة', value: '900' }, { label: '20 دقيقة', value: '1200' },
            { label: '30 دقيقة', value: '1800' }
          ];
          const tp = new StringSelectMenuBuilder().setCustomId(tvId).setPlaceholder('المدة...').addOptions(opts);
          await tI.update({ embeds: [makeEmbed(`⏱️ ${type === 'join' ? 'التسجيل' : 'اللعب'}`, `\`\`\`\nالحالي: ${formatTimer(type === 'join' ? guildData.joinTimer : guildData.gameTimer)}\n\`\`\``, CONFIG.COLORS.WARNING)], components: [new ActionRowBuilder().addComponents(tp)] });
          const vI = await tMsg.awaitMessageComponent({ filter: i => i.customId === tvId && i.user.id === message.author.id, time: 20000 });
          const val = parseInt(vI.values[0]);
          if (type === 'join') guildData.joinTimer = val; else guildData.gameTimer = val;
          saveGuild(message.guild.id, guildData);
          await vI.update({ embeds: [makeEmbed('✅', `\`\`\`\n${type === 'join' ? 'التسجيل' : 'اللعب'}: ${formatTimer(val)}\n\`\`\``, CONFIG.COLORS.SUCCESS)], components: [] });
          setTimeout(() => tMsg.delete().catch(() => {}), 5000);
        } catch { await tMsg.edit({ components: [] }).catch(() => {}); }
        try { await message.delete(); } catch {}
        break;
      }

      case 'addchallenge': {
        if (!isAdmin(message.author.id, guildData)) return;
        const p = await message.channel.send({ embeds: [makeEmbed('📝', '```\nاكتب التحديات مفصولة بفاصلة ,\n```', CONFIG.COLORS.WARNING)] });
        try {
          const col = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 120000, errors: ['time'] });
          const ch = col.first().content.split(',').map(c => c.trim()).filter(c => c);
          try { await p.delete(); } catch {} try { await col.first().delete(); } catch {}
          if (!ch.length) return;
          guildData.challenges.push(...ch); saveGuild(message.guild.id, guildData);
          const r = await message.channel.send({ embeds: [makeEmbed('✅', `\`\`\`\n+${ch.length} تحدي\n\`\`\``, CONFIG.COLORS.SUCCESS)] });
          setTimeout(() => r.delete().catch(() => {}), 8000);
        } catch {}
        try { await message.delete(); } catch {}
        break;
      }

      case 'removechallenge': {
        if (!isAdmin(message.author.id, guildData)) return;
        if (!guildData.challenges?.length) return message.reply({ embeds: [makeEmbed('❌', 'فارغ.', CONFIG.COLORS.ERROR)] });
        const dcId = `dc_${Date.now()}`;
        const opts = guildData.challenges.slice(0, 25).map((c, i) => ({ label: truncName(c, 50), value: `${i}`, description: guildData.usedChallenges?.includes(c) ? '✅ مستخدم' : '⬜ متاح' }));
        const dm = new StringSelectMenuBuilder().setCustomId(dcId).setPlaceholder('اختر...').addOptions(opts);
        const dMsg = await message.channel.send({ embeds: [makeEmbed('🗑️', '```\nاختر التحدي\n```', CONFIG.COLORS.WARNING)], components: [new ActionRowBuilder().addComponents(dm)] });
        try {
          const di = await dMsg.awaitMessageComponent({ filter: i => i.customId === dcId && i.user.id === message.author.id, time: 15000 });
          const removed = guildData.challenges.splice(parseInt(di.values[0]), 1)[0];
          guildData.usedChallenges = (guildData.usedChallenges || []).filter(c => c !== removed);
          saveGuild(message.guild.id, guildData);
          await di.update({ embeds: [makeEmbed('✅', `\`\`\`\nحذف: ${removed}\n\`\`\``, CONFIG.COLORS.SUCCESS)], components: [] });
          setTimeout(() => dMsg.delete().catch(() => {}), 5000);
        } catch { await dMsg.edit({ components: [] }).catch(() => {}); }
        try { await message.delete(); } catch {}
        break;
      }

      case 'challenges': {
        if (!isAdmin(message.author.id, guildData)) return;
        const ch = guildData.challenges || [];
        if (!ch.length) return message.reply({ embeds: [makeEmbed('📋', '`$addchallenge`', CONFIG.COLORS.WARNING)] });
        const used = guildData.usedChallenges || [];
        let desc = `**${ch.length}** تحدي (${ch.length - used.length} متاح)\n\n`;
        ch.forEach((c, i) => { const u = used.includes(c); desc += `${u ? '~~' : ''}**${i + 1}.** ${c}${u ? '~~' : ''}\n`; });
        await message.reply({ embeds: [makeEmbed('📋', desc, CONFIG.COLORS.INFO)] });
        break;
      }

      case 'leaderboard': {
        const pl = guildData.gameStats?.players || {};
        const en = Object.entries(pl).map(([id, s]) => ({ id, ...s })).sort((a, b) => b.wins - a.wins).slice(0, 10);
        if (!en.length) return message.reply({ embeds: [makeEmbed('🏆', '```\nفارغ\n```', CONFIG.COLORS.WARNING)] });
        const md = ['🥇', '🥈', '🥉'];
        await message.reply({ embeds: [makeEmbed('🏆', en.map((p, i) => `${md[i] || `**${i + 1}.**`} <@${p.id}> — ${p.wins}W/${p.losses}L (${p.games})`).join('\n'), CONFIG.COLORS.GOLD)] });
        break;
      }

      case 'gamestats': {
        const st = guildData.gameStats || { totalGames: 0, players: {} };
        let d = `\`\`\`\n🎮 ${st.totalGames} | 👥 ${Object.keys(st.players).length}\n\`\`\``;
        const m = message.mentions.users.first();
        if (m) { const ps = st.players[m.id]; if (ps) { d += `\n**${m.displayName}:**\n\`\`\`\n🏆 ${ps.wins} | 💀 ${ps.losses} | 🎮 ${ps.games} | ${ps.games > 0 ? ((ps.wins / ps.games) * 100).toFixed(0) : 0}%\n\`\`\``; } else d += `\n${m} لم يلعب.`; }
        await message.reply({ embeds: [makeEmbed('📊', d, CONFIG.COLORS.INFO)] });
        break;
      }

      case 'addcmd': {
        if (!isOwner(message.author.id, guildData)) return;
        const aliases = guildData.aliases || JSON.parse(JSON.stringify(DEFAULT_ALIASES));
        const cmdList = Object.entries(aliases).map(([k, v]) => ({
          label: `$${k}`, value: k, description: truncName(`${v.join(', ')}`, 100)
        }));
        const cmdMenuId = `acmd_${Date.now()}`;
        const cmdMenu = new StringSelectMenuBuilder().setCustomId(cmdMenuId).setPlaceholder('اختر الأمر...').addOptions(cmdList);
        const cmdMsg = await message.channel.send({
          embeds: [makeEmbed('🔧', '```\nاختر الأمر\n```', CONFIG.COLORS.WARNING)],
          components: [new ActionRowBuilder().addComponents(cmdMenu)]
        });
        try {
          const cmdInt = await cmdMsg.awaitMessageComponent({ filter: i => i.customId === cmdMenuId && i.user.id === message.author.id, time: 30000 });
          const selectedCmd = cmdInt.values[0];
          const actionMenuId = `aact_${Date.now()}`;
          const actionMenu = new StringSelectMenuBuilder().setCustomId(actionMenuId).setPlaceholder('الإجراء...').addOptions([
            { label: '➕ إضافة', value: 'add' }, { label: '➖ حذف', value: 'remove' }, { label: '📋 عرض', value: 'view' }
          ]);
          await cmdInt.update({ embeds: [makeEmbed(`🔧 $${selectedCmd}`, `الحالية: ${aliases[selectedCmd].join(', ')}`, CONFIG.COLORS.WARNING)], components: [new ActionRowBuilder().addComponents(actionMenu)] });
          const actInt = await cmdMsg.awaitMessageComponent({ filter: i => i.customId === actionMenuId && i.user.id === message.author.id, time: 20000 });
          if (actInt.values[0] === 'add') {
            await actInt.deferUpdate();
            const pm = await message.channel.send({ embeds: [makeEmbed('📝', '```\nاكتب الاختصار بدون $\n```', CONFIG.COLORS.WARNING)] });
            try {
              const col = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 30000, errors: ['time'] });
              const na = col.first().content.trim().toLowerCase();
              try { await pm.delete(); } catch {} try { await col.first().delete(); } catch {}
              let conflict = false; for (const [, v] of Object.entries(aliases)) { if (v.includes(na)) { conflict = true; break; } }
              if (conflict) { await cmdMsg.edit({ embeds: [makeEmbed('❌', `\`${na}\` مستخدم.`, CONFIG.COLORS.ERROR)], components: [] }); }
              else { aliases[selectedCmd].push(na); guildData.aliases = aliases; saveGuild(message.guild.id, guildData); await cmdMsg.edit({ embeds: [makeEmbed('✅', `+${na} → ${aliases[selectedCmd].join(', ')}`, CONFIG.COLORS.SUCCESS)], components: [] }); }
            } catch { try { await pm.delete(); } catch {} await cmdMsg.edit({ embeds: [makeEmbed('❌', 'انتهى.', CONFIG.COLORS.ERROR)], components: [] }); }
          } else if (actInt.values[0] === 'remove') {
            const ca = aliases[selectedCmd].filter(a => a !== selectedCmd);
            if (!ca.length) { await actInt.update({ embeds: [makeEmbed('❌', 'لا إضافية.', CONFIG.COLORS.ERROR)], components: [] }); }
            else {
              const dmi = `adel_${Date.now()}`;
              await actInt.update({ embeds: [makeEmbed('➖', '```\nاختر\n```', CONFIG.COLORS.WARNING)], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(dmi).setPlaceholder('اختر...').addOptions(ca.map(a => ({ label: a, value: a }))))] });
              try { const di = await cmdMsg.awaitMessageComponent({ filter: i => i.customId === dmi && i.user.id === message.author.id, time: 15000 }); aliases[selectedCmd] = aliases[selectedCmd].filter(a => a !== di.values[0]); guildData.aliases = aliases; saveGuild(message.guild.id, guildData); await di.update({ embeds: [makeEmbed('✅', `حذف ${di.values[0]}`, CONFIG.COLORS.SUCCESS)], components: [] }); } catch {}
            }
          } else { await actInt.update({ embeds: [makeEmbed(`📋 $${selectedCmd}`, aliases[selectedCmd].join(', '), CONFIG.COLORS.INFO)], components: [] }); }
          setTimeout(() => cmdMsg.delete().catch(() => {}), 8000);
        } catch { await cmdMsg.edit({ components: [] }).catch(() => {}); }
        try { await message.delete(); } catch {}
        break;
      }

      case 'admin': {
        if (!isOwner(message.author.id, guildData)) return;
        try { await message.delete(); } catch {}

        const adminEmbed = makeEmbed('⚙️ لوحة التحكم', '```\nاختر العملية\n```', CONFIG.COLORS.PRIMARY);
        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('adm_bn').setLabel('اسم البوت').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
          new ButtonBuilder().setCustomId('adm_ba').setLabel('صورة البوت').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
          new ButtonBuilder().setCustomId('adm_bb').setLabel('بنر البوت').setStyle(ButtonStyle.Secondary).setEmoji('🎨'),
          new ButtonBuilder().setCustomId('adm_bs').setLabel('الستاتس').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
          new ButtonBuilder().setCustomId('adm_bp').setLabel('الحالة').setStyle(ButtonStyle.Secondary).setEmoji('🟢')
        );
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('adm_aa').setLabel('+ أدمن').setStyle(ButtonStyle.Success).setEmoji('➕'),
          new ButtonBuilder().setCustomId('adm_da').setLabel('- أدمن').setStyle(ButtonStyle.Danger).setEmoji('➖'),
          new ButtonBuilder().setCustomId('adm_ao').setLabel('+ أونر').setStyle(ButtonStyle.Success).setEmoji('👑'),
          new ButtonBuilder().setCustomId('adm_do').setLabel('- أونر').setStyle(ButtonStyle.Danger).setEmoji('🚫')
        );

        const aMsg = await message.channel.send({ embeds: [adminEmbed], components: [row1, row2] });

        try {
          const aI = await aMsg.awaitMessageComponent({
            filter: i => i.customId.startsWith('adm_') && i.user.id === message.author.id,
            time: 30000
          });

          const action = aI.customId.replace('adm_', '');

          const askText = async (prompt) => {
            await aI.update({ embeds: [makeEmbed('📝', `\`\`\`\n${prompt}\n\`\`\``, CONFIG.COLORS.WARNING)], components: [] });
            try {
              const col = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 30000, errors: ['time'] });
              const val = col.first().content;
              try { await col.first().delete(); } catch {}
              return val;
            } catch { return null; }
          };

          switch (action) {
            case 'bn': {
              const n = await askText('اكتب الاسم الجديد');
              if (!n) { await aMsg.edit({ embeds: [makeEmbed('❌', 'انتهى الوقت.', CONFIG.COLORS.ERROR)], components: [] }); break; }
              try { await client.user.setUsername(n); await aMsg.edit({ embeds: [makeEmbed('✅', `الاسم: ${n}`, CONFIG.COLORS.SUCCESS)], components: [] }); }
              catch (e) { await aMsg.edit({ embeds: [makeEmbed('❌', e.message, CONFIG.COLORS.ERROR)], components: [] }); }
              break;
            }
            case 'ba': {
              const u = await askText('أرسل رابط الصورة');
              if (!u) { await aMsg.edit({ embeds: [makeEmbed('❌', 'انتهى الوقت.', CONFIG.COLORS.ERROR)], components: [] }); break; }
              try { await client.user.setAvatar(u); await aMsg.edit({ embeds: [makeEmbed('✅', 'تم تغيير الصورة.', CONFIG.COLORS.SUCCESS)], components: [] }); }
              catch (e) { await aMsg.edit({ embeds: [makeEmbed('❌', e.message, CONFIG.COLORS.ERROR)], components: [] }); }
              break;
            }
            case 'bb': {
              const u = await askText('أرسل رابط البنر');
              if (!u) { await aMsg.edit({ embeds: [makeEmbed('❌', 'انتهى الوقت.', CONFIG.COLORS.ERROR)], components: [] }); break; }
              try { await client.user.setBanner(u); await aMsg.edit({ embeds: [makeEmbed('✅', 'تم تغيير البنر.', CONFIG.COLORS.SUCCESS)], components: [] }); }
              catch (e) { await aMsg.edit({ embeds: [makeEmbed('❌', e.message, CONFIG.COLORS.ERROR)], components: [] }); }
              break;
            }
            case 'bs': {
              const s = await askText('اكتب الستاتس');
              if (!s) { await aMsg.edit({ embeds: [makeEmbed('❌', 'انتهى الوقت.', CONFIG.COLORS.ERROR)], components: [] }); break; }
              client.user.setActivity(s, { type: 0 });
              await aMsg.edit({ embeds: [makeEmbed('✅', `الستاتس: ${s}`, CONFIG.COLORS.SUCCESS)], components: [] });
              break;
            }
            case 'bp': {
              const bpRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bp_online').setLabel('متصل').setStyle(ButtonStyle.Success).setEmoji('🟢'),
                new ButtonBuilder().setCustomId('bp_idle').setLabel('بعيد').setStyle(ButtonStyle.Secondary).setEmoji('🟡'),
                new ButtonBuilder().setCustomId('bp_dnd').setLabel('مشغول').setStyle(ButtonStyle.Danger).setEmoji('🔴'),
                new ButtonBuilder().setCustomId('bp_invisible').setLabel('مخفي').setStyle(ButtonStyle.Secondary).setEmoji('⚫')
              );
              await aI.update({ embeds: [makeEmbed('🟢', '```\nاختر الحالة\n```', CONFIG.COLORS.WARNING)], components: [bpRow] });
              try {
                const bpI = await aMsg.awaitMessageComponent({ filter: i => i.customId.startsWith('bp_') && i.user.id === message.author.id, time: 15000 });
                const status = bpI.customId.replace('bp_', '');
                client.user.setPresence({ status });
                await bpI.update({ embeds: [makeEmbed('✅', `الحالة: ${status}`, CONFIG.COLORS.SUCCESS)], components: [] });
              } catch { await aMsg.edit({ components: [] }).catch(() => {}); }
              break;
            }
            case 'aa': {
              const m = await askText('منشن العضو أو الآيدي');
              if (!m) { await aMsg.edit({ embeds: [makeEmbed('❌', 'انتهى الوقت.', CONFIG.COLORS.ERROR)], components: [] }); break; }
              const uid = m.replace(/[<@!>]/g, '').trim();
              if (!uid || uid.length < 15) { await aMsg.edit({ embeds: [makeEmbed('❌', 'آيدي غير صالح.', CONFIG.COLORS.ERROR)], components: [] }); break; }
              if (!guildData.admins) guildData.admins = [];
              if (guildData.admins.includes(uid)) { await aMsg.edit({ embeds: [makeEmbed('❌', 'موجود.', CONFIG.COLORS.ERROR)], components: [] }); }
              else { guildData.admins.push(uid); saveGuild(message.guild.id, guildData); await aMsg.edit({ embeds: [makeEmbed('✅', `<@${uid}> أدمن ✅`, CONFIG.COLORS.SUCCESS)], components: [] }); }
              break;
            }
            case 'da': {
              if (!guildData.admins?.length) { await aI.update({ embeds: [makeEmbed('❌', 'لا أدمنز.', CONFIG.COLORS.ERROR)], components: [] }); break; }
              const daRow = new ActionRowBuilder();
              const btns = [];
              for (const id of guildData.admins.slice(0, 5)) {
                let label = id;
                try { const mb = await message.guild.members.fetch(id).catch(() => null); if (mb) label = mb.displayName; } catch {}
                btns.push(new ButtonBuilder().setCustomId(`rmadm_${id}`).setLabel(truncName(label, 40)).setStyle(ButtonStyle.Danger));
              }
              daRow.addComponents(btns);
              await aI.update({ embeds: [makeEmbed('➖', '```\nاختر الأدمن لحذفه\n```', CONFIG.COLORS.WARNING)], components: [daRow] });
              try {
                const di = await aMsg.awaitMessageComponent({ filter: i => i.customId.startsWith('rmadm_') && i.user.id === message.author.id, time: 15000 });
                const rid = di.customId.replace('rmadm_', '');
                guildData.admins = guildData.admins.filter(id => id !== rid);
                saveGuild(message.guild.id, guildData);
                await di.update({ embeds: [makeEmbed('✅', `<@${rid}> حُذف ❌`, CONFIG.COLORS.SUCCESS)], components: [] });
              } catch { await aMsg.edit({ components: [] }).catch(() => {}); }
              break;
            }
            case 'ao': {
              const m = await askText('منشن العضو أو الآيدي');
              if (!m) { await aMsg.edit({ embeds: [makeEmbed('❌', 'انتهى الوقت.', CONFIG.COLORS.ERROR)], components: [] }); break; }
              const uid = m.replace(/[<@!>]/g, '').trim();
              if (!uid || uid.length < 15) { await aMsg.edit({ embeds: [makeEmbed('❌', 'آيدي غير صالح.', CONFIG.COLORS.ERROR)], components: [] }); break; }
              if (!guildData.owners) guildData.owners = [];
              if (guildData.owners.includes(uid)) { await aMsg.edit({ embeds: [makeEmbed('❌', 'موجود.', CONFIG.COLORS.ERROR)], components: [] }); }
              else { guildData.owners.push(uid); saveGuild(message.guild.id, guildData); await aMsg.edit({ embeds: [makeEmbed('✅', `<@${uid}> أونر 👑`, CONFIG.COLORS.SUCCESS)], components: [] }); }
              break;
            }
            case 'do': {
              if (!guildData.owners?.length) { await aI.update({ embeds: [makeEmbed('❌', 'لا أونرز.', CONFIG.COLORS.ERROR)], components: [] }); break; }
              const doRow = new ActionRowBuilder();
              const obtns = [];
              for (const id of guildData.owners.slice(0, 5)) {
                let label = id;
                try { const mb = await message.guild.members.fetch(id).catch(() => null); if (mb) label = mb.displayName; } catch {}
                obtns.push(new ButtonBuilder().setCustomId(`rmown_${id}`).setLabel(truncName(label, 40)).setStyle(ButtonStyle.Danger));
              }
              doRow.addComponents(obtns);
              await aI.update({ embeds: [makeEmbed('➖', '```\nاختر الأونر لحذفه\n```', CONFIG.COLORS.WARNING)], components: [doRow] });
              try {
                const di = await aMsg.awaitMessageComponent({ filter: i => i.customId.startsWith('rmown_') && i.user.id === message.author.id, time: 15000 });
                const rid = di.customId.replace('rmown_', '');
                guildData.owners = guildData.owners.filter(id => id !== rid);
                saveGuild(message.guild.id, guildData);
                await di.update({ embeds: [makeEmbed('✅', `<@${rid}> حُذف ❌`, CONFIG.COLORS.SUCCESS)], components: [] });
              } catch { await aMsg.edit({ components: [] }).catch(() => {}); }
              break;
            }
          }
          setTimeout(() => aMsg.delete().catch(() => {}), 8000);
        } catch { await aMsg.edit({ components: [] }).catch(() => {}); }
        break;
      }

      case 'help': {
        if (!isAdmin(message.author.id, guildData)) return;
        const aliases = guildData.aliases || DEFAULT_ALIASES;
        let aliasInfo = '\n\n**🔧 الاختصارات:**\n';
        for (const [k, v] of Object.entries(aliases)) { if (v.length > 1) aliasInfo += `\`$${k}\` ← ${v.filter(a => a !== k).map(a => `\`$${a}\``).join(', ')}\n`; }
        await message.reply({
          embeds: [new EmbedBuilder().setAuthor({ name: '⚡ تحدي الـ 7 ثواني' }).setDescription(
            '**🎮:**\n`$game` `$cancel`\n\n**⚙️:**\n`$setresult #روم` `$setlog #روم` `$settimer`\n\n**📋:**\n`$addchallenge` `$removechallenge` `$challenges`\n\n**📊:**\n`$leaderboard` `$gamestats`\n\n**🔧:**\n`$admin` `$addcmd`\n\n**🎮 أثناء المزاد:**\n`$روح @الخصم`\n\n**📌 ملاحظات:**\n• الفائز يحصل على رول 🏆\n• اللاعبين يخرجون من الروليت بعد جولتهم\n• لو العدد فردي، الأخير يفوز تلقائياً' + aliasInfo
          ).setColor(CONFIG.COLORS.INFO).setFooter({ text: CONFIG.FOOTER })]
        });
        break;
      }
    }
  } catch (error) {
    console.error('Error:', error);
    try { await message.reply({ embeds: [makeEmbed('❌', `\`\`\`\n${error.message}\n\`\`\``, CONFIG.COLORS.ERROR)] }); } catch {}
  }
});

client.once('ready', () => {
  console.log(`✅ ${client.user.tag} online`);
  client.user.setActivity('⚡ تحدي الـ 7 ثواني', { type: 3 });
});

process.on('unhandledRejection', e => console.error('Unhandled:', e));
process.on('uncaughtException', e => console.error('Uncaught:', e));

client.login(TOKEN);
