// prize-wheel.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ComponentType
} = require('discord.js');
const { createCanvas } = require('canvas');
const GIFEncoder = require('gifencoder');
const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════════
// ⚙️ إعدادات النظام - سهلة التعديل
// ════════════════════════════════════════════
const PRIZE_CONFIG = {
  PREFIX: '$',
  COMMAND: 'جائزة', // الأمر الرئيسي
  
  // ⏱️ الأوقات
  JOIN_TIME: 30, // وقت التسجيل بالثواني
  
  // 🎨 الألوان
  COLORS: {
    PRIMARY: 0x2B2D31,
    SUCCESS: 0x23A559,
    ERROR: 0xF23F43,
    WARNING: 0xF0B232,
    PRIZE: 0xF1C40F
  },
  
  // 🎁 الجوائز مع النسب (المجموع يجب = 100)
  // ⚠️ إذا حطيت probability: 0 معناها الجائزة تظهر بس مستحيل تطلع
  PRIZES: [
    { name: '💎 نيترو قيمنق لمدة شهر ', probability: 0 },      // 5%
    { name: '🏆 ايفكت من اختيارك', probability: 0 },    // 10%
    { name: '🎖️ رول خاص ', probability: 30 },    // 15%
    { name: '🎁 50 نقطة روليت', probability: 50 },    // 30%
    { name: '🎫 حاول مرة اخرى', probability: 10 },        // 25%
    { name: '❌ حظ اوفر', probability: 10 }      // 15%
  ],
  
  // 🎨 ألوان العجلة
  WHEEL_COLORS: [
    '#5865F2', '#EB459E', '#57F287', '#FEE75C', '#ED4245',
    '#9B59B6', '#E91E63', '#2ECC71', '#F39C12', '#E74C3C'
  ],
  
  WIDTH: 600,
  HEIGHT: 600
};

// ════════════════════════════════════════════
// 📊 تخزين البيانات
// ════════════════════════════════════════════
const PRIZE_DATA_PATH = path.join(__dirname, 'prize-data.json');

function loadPrizeData() {
  try {
    if (!fs.existsSync(PRIZE_DATA_PATH)) {
      fs.writeFileSync(PRIZE_DATA_PATH, '{}');
      return {};
    }
    return JSON.parse(fs.readFileSync(PRIZE_DATA_PATH, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function savePrizeData(data) {
  fs.writeFileSync(PRIZE_DATA_PATH, JSON.stringify(data, null, 2));
}

function getPrizeGuild(guildId) {
  const data = loadPrizeData();
  if (!data[guildId]) {
    data[guildId] = {
      activeWheel: null,
      history: [],
      stats: {}
    };
    savePrizeData(data);
  }
  return data[guildId];
}

function savePrizeGuild(guildId, guildData) {
  const data = loadPrizeData();
  data[guildId] = guildData;
  savePrizeData(data);
}

// ════════════════════════════════════════════
// 🎨 رسم العجلة
// ════════════════════════════════════════════
function easeOutQuad(t) {
  return t * (2 - t);
}

function drawPrizeWheel(names, rotation) {
  const W = PRIZE_CONFIG.WIDTH;
  const H = PRIZE_CONFIG.HEIGHT;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const cx = W / 2;
  const cy = H / 2;
  const R = W / 2 - 50;
  const n = names.length;
  const sliceAngle = (2 * Math.PI) / n;

  // خلفية
  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, W, H);

  // إطار خارجي
  ctx.beginPath();
  ctx.arc(cx, cy, R + 12, 0, Math.PI * 2);
  ctx.strokeStyle = '#F1C40F';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#F1C40F';
  ctx.shadowBlur = 15;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // رسم الشرائح
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, 0, sliceAngle);
    ctx.closePath();
    ctx.fillStyle = PRIZE_CONFIG.WHEEL_COLORS[i % PRIZE_CONFIG.WHEEL_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // النص
    ctx.save();
    ctx.rotate(sliceAngle / 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    const textR = R * 0.35;
    const name = names[i].length > 12 ? names[i].substring(0, 11) + '…' : names[i];
    ctx.fillText(name, textR, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.rotate(sliceAngle);
  }

  ctx.restore();

  // المركز
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

  // السهم
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

  return { canvas, ctx };
}

// ════════════════════════════════════════════
// 🎯 اختيار الجائزة بناءً على النسب
// ════════════════════════════════════════════
function selectPrizeByProbability() {
  // 🔒 فلترة الجوائز - فقط اللي نسبتها أكبر من 0
  const availablePrizes = PRIZE_CONFIG.PRIZES.filter(prize => prize.probability > 0);
  
  // التأكد إن في جوائز متاحة
  if (availablePrizes.length === 0) {
    // إذا كل الجوائز صفر، نرجع أول جائزة
    return PRIZE_CONFIG.PRIZES[0];
  }
  
  const rand = Math.random() * 100;
  let cumulative = 0;
  
  // الاختيار فقط من الجوائز المتاحة (probability > 0)
  for (const prize of availablePrizes) {
    cumulative += prize.probability;
    if (rand <= cumulative) {
      return prize;
    }
  }
  
  // احتياطي: نرجع آخر جائزة متاحة
  return availablePrizes[availablePrizes.length - 1];
}

// ════════════════════════════════════════════
// 🎰 دوران العجلة
// ════════════════════════════════════════════
async function spinPrizeWheel(channel, playerNames, prizeName) {
  const n = playerNames.length;
  if (n === 0) return null;

  // ترتيب الأسماء بحيث يكون الفائز في الأعلى
  const winnerIndex = Math.floor(Math.random() * n);
  const winnerName = playerNames[winnerIndex];
  
  let reordered = [];
  for (let i = 0; i < n; i++) {
    if (i !== winnerIndex) reordered.push(playerNames[i]);
  }
  reordered.push(winnerName);
  reordered = reordered.reverse();

  const W = PRIZE_CONFIG.WIDTH;
  const H = PRIZE_CONFIG.HEIGHT;
  const sliceAngle = (2 * Math.PI) / n;
  const targetAngle = sliceAngle / 2;
  const fullRotations = 6 + Math.floor(Math.random() * 4);
  const totalRotation = fullRotations * 2 * Math.PI + targetAngle;

  const totalFrames = 25;
  const encoder = new GIFEncoder(W, H);
  const stream = encoder.createReadStream();
  const buffers = [];
  stream.on('data', (d) => buffers.push(d));

  encoder.start();
  encoder.setRepeat(-1);
  encoder.setQuality(10);

  // إنشاء الفريمات
  for (let i = 0; i <= totalFrames; i++) {
    const t = i / totalFrames;
    const easedT = easeOutQuad(t);
    const currentRotation = totalRotation * easedT;

    if (i < totalFrames * 0.3) {
      encoder.setDelay(40);
    } else if (i < totalFrames * 0.6) {
      encoder.setDelay(80);
    } else if (i < totalFrames * 0.85) {
      encoder.setDelay(140);
    } else {
      encoder.setDelay(250);
    }

    const { ctx } = drawPrizeWheel(reordered, -currentRotation);
    encoder.addFrame(ctx);
  }

  encoder.setDelay(2000);
  const { ctx: lastCtx } = drawPrizeWheel(reordered, -totalRotation);
  encoder.addFrame(lastCtx);

  encoder.finish();

  await new Promise(resolve => stream.on('end', resolve));
  const gifBuffer = Buffer.concat(buffers);

  // إرسال العجلة
  const att = new AttachmentBuilder(gifBuffer, { name: 'prize-spin.gif' });
  await channel.send({ 
    content: `**🎰 اختيار الفائز بـ ${prizeName}**`, 
    files: [att] 
  });

  return { name: winnerName, index: winnerIndex };
}

// ════════════════════════════════════════════
// 🎁 دوران عجلة الجوائز
// ════════════════════════════════════════════
async function spinPrizeSelection(channel) {
  const prizeNames = PRIZE_CONFIG.PRIZES.map(p => p.name);
  const selectedPrize = selectPrizeByProbability();
  
  const prizeIndex = PRIZE_CONFIG.PRIZES.findIndex(p => p.name === selectedPrize.name);
  
  // ترتيب الجوائز بحيث تكون الجائزة المختارة في موضع الفوز
  let reordered = [];
  for (let i = 0; i < prizeNames.length; i++) {
    if (i !== prizeIndex) reordered.push(prizeNames[i]);
  }
  reordered.push(selectedPrize.name);
  reordered = reordered.reverse();

  const n = prizeNames.length;
  const W = PRIZE_CONFIG.WIDTH;
  const H = PRIZE_CONFIG.HEIGHT;
  const sliceAngle = (2 * Math.PI) / n;
  const targetAngle = sliceAngle / 2;
  const fullRotations = 8 + Math.floor(Math.random() * 5);
  const totalRotation = fullRotations * 2 * Math.PI + targetAngle;

  const totalFrames = 30;
  const encoder = new GIFEncoder(W, H);
  const stream = encoder.createReadStream();
  const buffers = [];
  stream.on('data', (d) => buffers.push(d));

  encoder.start();
  encoder.setRepeat(-1);
  encoder.setQuality(10);

  for (let i = 0; i <= totalFrames; i++) {
    const t = i / totalFrames;
    const easedT = easeOutQuad(t);
    const currentRotation = totalRotation * easedT;

    if (i < totalFrames * 0.3) {
      encoder.setDelay(35);
    } else if (i < totalFrames * 0.6) {
      encoder.setDelay(70);
    } else if (i < totalFrames * 0.85) {
      encoder.setDelay(130);
    } else {
      encoder.setDelay(220);
    }

    const { ctx } = drawPrizeWheel(reordered, -currentRotation);
    encoder.addFrame(ctx);
  }

  encoder.setDelay(2500);
  const { ctx: lastCtx } = drawPrizeWheel(reordered, -totalRotation);
  encoder.addFrame(lastCtx);

  encoder.finish();

  await new Promise(resolve => stream.on('end', resolve));
  const gifBuffer = Buffer.concat(buffers);

  const att = new AttachmentBuilder(gifBuffer, { name: 'prize-result.gif' });
  await channel.send({ 
    content: `**🎁 اختيار الجائزة...**`, 
    files: [att] 
  });

  return selectedPrize;
}

// ════════════════════════════════════════════
// 🎮 تشغيل النظام
// ════════════════════════════════════════════
async function startPrizeWheel(message, client) {
  const guildData = getPrizeGuild(message.guild.id);
  
  if (guildData.activeWheel) {
    return message.reply({
      embeds: [new EmbedBuilder()
        .setAuthor({ name: '❌ يوجد سحب نشط' })
        .setDescription('```\nانتظر انتهاء السحب الحالي\n```')
        .setColor(PRIZE_CONFIG.COLORS.ERROR)]
    });
  }

  try {
    await message.delete();
  } catch {}

  // إعداد السحب
  const participants = new Set();
  const joinTimer = PRIZE_CONFIG.JOIN_TIME;

  const joinEmbed = new EmbedBuilder()
    .setAuthor({ name: '🎁 سحب على الجوائز' })
    .setDescription(`\`\`\`\n🎰 انضم الآن للسحب!\n\`\`\`\n**المشاركين:** 0\n**⏱️ الوقت المتبقي:** ${joinTimer} ثانية\n\n**🎁 الجوائز المتاحة:**\n${PRIZE_CONFIG.PRIZES.map(p => `${p.name} — ${p.probability}%`).join('\n')}`)
    .setColor(PRIZE_CONFIG.COLORS.PRIZE)
    .setFooter({ text: '🎁 حظ سعيد!' })
    .setTimestamp();

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('prize_join')
      .setLabel('انضمام للسحب')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫')
  );

  const joinMsg = await message.channel.send({ 
    embeds: [joinEmbed], 
    components: [joinRow] 
  });

  guildData.activeWheel = {
    channelId: message.channel.id,
    messageId: joinMsg.id,
    startedBy: message.author.id
  };
  savePrizeGuild(message.guild.id, guildData);

  // عداد الوقت
  let remaining = joinTimer;
  const timerInterval = setInterval(async () => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(timerInterval);
      return;
    }
    if (remaining % 5 === 0 || remaining <= 3) {
      try {
        const updatedEmbed = EmbedBuilder.from(joinEmbed)
          .setDescription(`\`\`\`\n🎰 انضم الآن للسحب!\n\`\`\`\n**المشاركين:** ${participants.size}\n**⏱️ الوقت المتبقي:** ${remaining} ثانية\n\n**🎁 الجوائز المتاحة:**\n${PRIZE_CONFIG.PRIZES.map(p => `${p.name} — ${p.probability}%`).join('\n')}`);
        await joinMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
      } catch {}
    }
  }, 1000);

  // جمع المشاركين
  const collector = joinMsg.createMessageComponentCollector({ 
    componentType: ComponentType.Button, 
    time: joinTimer * 1000 
  });

  collector.on('collect', async (i) => {
    if (i.customId === 'prize_join') {
      if (i.user.bot) return i.deferUpdate();
      
      if (participants.has(i.user.id)) {
        return i.reply({ 
          content: '⚠️ أنت مسجل بالفعل!', 
          ephemeral: true 
        });
      }
      
      participants.add(i.user.id);
      const updatedEmbed = EmbedBuilder.from(joinEmbed)
        .setDescription(`\`\`\`\n🎰 انضم الآن للسحب!\n\`\`\`\n**المشاركين:** ${participants.size}\n**⏱️ الوقت المتبقي:** ${remaining} ثانية\n\n**🎁 الجوائز المتاحة:**\n${PRIZE_CONFIG.PRIZES.map(p => `${p.name} — ${p.probability}%`).join('\n')}`);
      
      await joinMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
      await i.reply({ 
        content: `🎫 تم تسجيلك! (${participants.size} مشارك)`, 
        ephemeral: true 
      });
    }
  });

  await new Promise(resolve => collector.on('end', () => resolve()));
  clearInterval(timerInterval);
  await joinMsg.edit({ components: [] }).catch(() => {});

  // التحقق من العدد
  if (participants.size < 1) {
    guildData.activeWheel = null;
    savePrizeGuild(message.guild.id, guildData);
    return message.channel.send({
      embeds: [new EmbedBuilder()
        .setAuthor({ name: '❌ لم ينضم أحد' })
        .setDescription('```\nلم يشارك أحد في السحب\n```')
        .setColor(PRIZE_CONFIG.COLORS.ERROR)]
    });
  }

  // جلب الأسماء
  const playerIds = [...participants];
  const playerNames = [];
  const playerMembers = [];
  
  for (const id of playerIds) {
    try {
      const m = await message.guild.members.fetch(id);
      playerNames.push(m.displayName);
      playerMembers.push(m);
    } catch {}
  }

  if (playerMembers.length < 1) {
    guildData.activeWheel = null;
    savePrizeGuild(message.guild.id, guildData);
    return message.channel.send({
      embeds: [new EmbedBuilder()
        .setAuthor({ name: '❌ خطأ' })
        .setDescription('```\nفشل جلب المشاركين\n```')
        .setColor(PRIZE_CONFIG.COLORS.ERROR)]
    });
  }

  await new Promise(r => setTimeout(r, 2000));

  // 🎰 المرحلة 1: اختيار الجائزة
  await message.channel.send({
    embeds: [new EmbedBuilder()
      .setAuthor({ name: '🎁 المرحلة الأولى' })
      .setDescription('```\nاختيار الجائزة...\n```')
      .setColor(PRIZE_CONFIG.COLORS.PRIZE)]
  });

  await new Promise(r => setTimeout(r, 1500));
  
  const selectedPrize = await spinPrizeSelection(message.channel);

  await new Promise(r => setTimeout(r, 2000));

  await message.channel.send({
    embeds: [new EmbedBuilder()
      .setAuthor({ name: '🎁 الجائزة المختارة' })
      .setDescription(`\`\`\`\n${selectedPrize.name}\n\`\`\``)
      .setColor(PRIZE_CONFIG.COLORS.SUCCESS)
      .setFooter({ text: `احتمالية: ${selectedPrize.probability}%` })]
  });

  await new Promise(r => setTimeout(r, 3000));

  // 🎰 المرحلة 2: اختيار الفائز
  await message.channel.send({
    embeds: [new EmbedBuilder()
      .setAuthor({ name: '👤 المرحلة الثانية' })
      .setDescription('```\nاختيار الفائز...\n```')
      .setColor(PRIZE_CONFIG.COLORS.PRIZE)]
  });

  await new Promise(r => setTimeout(r, 1500));

  const winner = await spinPrizeWheel(message.channel, playerNames, selectedPrize.name);

  if (!winner) {
    guildData.activeWheel = null;
    savePrizeGuild(message.guild.id, guildData);
    return;
  }

  const winnerMember = playerMembers[winner.index];

  await new Promise(r => setTimeout(r, 2000));

  // النتيجة النهائية
  await message.channel.send({
    embeds: [new EmbedBuilder()
      .setAuthor({ name: '🎉 مبروك!' })
      .setDescription(`**الفائز:** ${winnerMember}\n\n**الجائزة:**\n\`\`\`\n${selectedPrize.name}\n\`\`\``)
      .setThumbnail(winnerMember.user.displayAvatarURL({ size: 128 }))
      .setColor(PRIZE_CONFIG.COLORS.SUCCESS)
      .setFooter({ text: `احتمالية: ${selectedPrize.probability}% | ${playerMembers.length} مشارك` })
      .setTimestamp()]
  });

  // حفظ الإحصائيات
  if (!guildData.stats[winnerMember.id]) {
    guildData.stats[winnerMember.id] = { wins: 0, prizes: [] };
  }
  guildData.stats[winnerMember.id].wins++;
  guildData.stats[winnerMember.id].prizes.push(selectedPrize.name);
  
  guildData.history.push({
    winner: winnerMember.id,
    prize: selectedPrize.name,
    participants: playerMembers.length,
    timestamp: Date.now()
  });

  guildData.activeWheel = null;
  savePrizeGuild(message.guild.id, guildData);
}

// ════════════════════════════════════════════
// 📊 الإحصائيات
// ════════════════════════════════════════════
function showPrizeStats(message) {
  const guildData = getPrizeGuild(message.guild.id);
  
  if (!guildData.history.length) {
    return message.reply({
      embeds: [new EmbedBuilder()
        .setAuthor({ name: '📊 الإحصائيات' })
        .setDescription('```\nلا توجد إحصائيات بعد\n```')
        .setColor(PRIZE_CONFIG.COLORS.WARNING)]
    });
  }

  const topWinners = Object.entries(guildData.stats)
    .map(([id, data]) => ({ id, wins: data.wins }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 10);

  const medals = ['🥇', '🥈', '🥉'];
  
  const description = `**إجمالي السحوبات:** ${guildData.history.length}\n\n**🏆 أكثر الفائزين:**\n${topWinners.map((w, i) => 
    `${medals[i] || `**${i + 1}.**`} <@${w.id}> — ${w.wins} مرة`
  ).join('\n')}`;

  message.reply({
    embeds: [new EmbedBuilder()
      .setAuthor({ name: '📊 إحصائيات السحوبات' })
      .setDescription(description)
      .setColor(PRIZE_CONFIG.COLORS.PRIZE)
      .setTimestamp()]
  });
}

// ════════════════════════════════════════════
// 📤 التصدير
// ════════════════════════════════════════════
module.exports = {
  PRIZE_CONFIG,
  startPrizeWheel,
  showPrizeStats
};
