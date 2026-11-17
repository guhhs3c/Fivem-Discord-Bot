import { EmbedBuilder } from 'discord.js';
import { LANGUAGES, GENERAL_LINKS, TOPICS } from '../../utils/fivemDocsData.js'; // sesuaikan path

const LANG_ALIASES = {
  lua: 'lua',
  csharp: 'csharp',
  'c#': 'csharp',
  cs: 'csharp',
  js: 'js',
  javascript: 'js',
};

const TOPIC_ALIASES = {
  commands: 'commands',
  command: 'commands',
  cmd: 'commands',
  events: 'events',
  event: 'events',
  exports: 'exports',
  export: 'exports',
  statebags: 'statebags',
  statebag: 'statebags',
  state: 'statebags',
  nui: 'nui',
  ui: 'nui',
};

function codeLang(langKey) {
  return langKey === 'js' ? 'js' : langKey === 'csharp' ? 'cs' : 'lua';
}

function buildLanguageEmbed(langKey) {
  const lang = LANGUAGES[langKey];
  const topicList = Object.keys(TOPICS)
    .map((t) => `\`${t}\``)
    .join(', ');

  return new EmbedBuilder()
    .setTitle(`FiveM Scripting — ${lang.label}`)
    .setColor(lang.color)
    .setDescription(
      [
        `**Getting Started:** ${lang.gettingStarted}`,
        `**Function Reference:** ${lang.reference}`,
        `**Runtime Docs:** ${lang.runtime}`,
        `**Native Functions (semua bahasa):** ${GENERAL_LINKS.natives.url}`,
        '',
        `Mau lebih spesifik? \`!fivem-help ${langKey} <topik>\` — topik: ${topicList}`,
      ].join('\n')
    )
    .addFields({
      name: 'Contoh Snippet Dasar',
      value: `\`\`\`${codeLang(langKey)}\n${lang.snippet}\n\`\`\``,
    })
    .setFooter({ text: 'Sumber: docs.fivem.net (Cfx.re Docs)' });
}

function buildTopicEmbed(langKey, topicKey) {
  const lang = LANGUAGES[langKey];
  const topic = TOPICS[topicKey];

  return new EmbedBuilder()
    .setTitle(`${topic.title} — ${lang.label}`)
    .setColor(lang.color)
    .setURL(topic.url)
    .setDescription(`**Dokumentasi resmi:** ${topic.url}`)
    .addFields({
      name: 'Contoh Kode',
      value: `\`\`\`${codeLang(langKey)}\n${topic.snippets[langKey]}\n\`\`\``,
    })
    .setFooter({ text: 'Sumber: docs.fivem.net (Cfx.re Docs)' });
}

function buildOverviewEmbed() {
  return new EmbedBuilder()
    .setTitle('FiveM Scripting Help — Lua / C# / JavaScript')
    .setColor(0x1abc9c)
    .setDescription(
      [
        'FiveM support 3 bahasa scripting: **Lua**, **C#**, dan **JavaScript**.',
        '',
        '`!fivem-help <lua|csharp|js>` → link resmi + snippet dasar per bahasa',
        '`!fivem-help <lua|csharp|js> <topik>` → snippet spesifik per topik',
        `Topik tersedia: ${Object.keys(TOPICS).map((t) => `\`${t}\``).join(', ')}`,
      ].join('\n')
    )
    .addFields(
      { name: 'Lua', value: LANGUAGES.lua.gettingStarted },
      { name: 'C#', value: LANGUAGES.csharp.gettingStarted },
      { name: 'JavaScript', value: LANGUAGES.js.gettingStarted },
      { name: GENERAL_LINKS.natives.title, value: GENERAL_LINKS.natives.url },
      { name: GENERAL_LINKS.resourceManifest.title, value: GENERAL_LINKS.resourceManifest.url },
      { name: GENERAL_LINKS.serverSetup.title, value: GENERAL_LINKS.serverSetup.url },
      { name: GENERAL_LINKS.serverHosting.title, value: GENERAL_LINKS.serverHosting.url }
    )
    .setFooter({ text: 'Sumber: docs.fivem.net & fivem.net (resmi)' });
}

export default {
  name: 'fivem-help',
  aliases: ['fivemdocs', 'fivem-docs'],
  description: 'Referensi resmi + contoh kode Lua/C#/JavaScript untuk scripting FiveM',
  usage: '[lua|csharp|js] [commands|events|exports|statebags|nui]',
  cooldown: 5,
  slashOptions: [
    {
      name: 'bahasa',
      description: 'Bahasa scripting',
      required: true,
      choices: [
        { name: 'Lua', value: 'lua' },
        { name: 'C#', value: 'csharp' },
        { name: 'JavaScript', value: 'js' },
      ],
    },
    {
      name: 'topik',
      description: 'Topik referensi',
      required: true,
      choices: [
        { name: 'Commands', value: 'commands' },
        { name: 'Events', value: 'events' },
        { name: 'Exports', value: 'exports' },
        { name: 'Statebags', value: 'statebags' },
        { name: 'NUI', value: 'nui' },
      ],
    },
  ],

  execute: async (message, args) => {
    if (!args.length) {
      return message.reply({ embeds: [buildOverviewEmbed()] });
    }

    const langKey = LANG_ALIASES[args[0].toLowerCase()];
    if (!langKey) {
      return message.reply(
        `Bahasa \`${args[0]}\` tidak dikenal. Pilihan: \`lua\`, \`csharp\` (atau \`cs\`/\`c#\`), \`js\` (atau \`javascript\`).`
      );
    }

    if (args.length === 1) {
      return message.reply({ embeds: [buildLanguageEmbed(langKey)] });
    }

    const topicKey = TOPIC_ALIASES[args[1].toLowerCase()];
    if (!topicKey) {
      const list = Object.keys(TOPICS).join(', ');
      return message.reply(`Topik \`${args[1]}\` tidak dikenal. Pilihan: ${list}`);
    }

    return message.reply({ embeds: [buildTopicEmbed(langKey, topicKey)] });
  },
};
