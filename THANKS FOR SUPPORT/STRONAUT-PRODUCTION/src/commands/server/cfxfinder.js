import {
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

import { servers } from 'cfx-api';

import {
    createErrorEmbed,
    createLoadingEmbed,
    SEPARATOR
} from '../../utils/embed.js';

import { config } from '../../config/config.js';

// =======================================================
// STRONAUT CFX FINDER
// cfx-api@2.0.1
//
// Menampilkan:
// - Hostname
// - CFX Code
// - IP:PORT
// - Players
// - Max Players
// - Game Type
// - Map
// - Resources
// - Tags
// - Locale
// - Build
// - Project Name
// - Project Description
// - Server Version
// - Owner
// - Owner ID
// - Connect Endpoint
// - Join URL
// - Icon
// - Banner
// - Dynamic Data
// - Info Data
// - Player Data
// =======================================================


// =======================================================
// HELPERS
// =======================================================

function extractCfxCode(input) {
    if (!input || typeof input !== 'string') {
        return null;
    }

    const value = input.trim();

    const cfxMatch = value.match(
        /(?:https?:\/\/)?(?:www\.)?cfx\.re\/join\/([a-z0-9]+)/i
    );

    if (cfxMatch) {
        return cfxMatch[1].toLowerCase();
    }

    const fivemMatch = value.match(
        /(?:https?:\/\/)?(?:www\.)?fivem\.net\/join\/([a-z0-9]+)/i
    );

    if (fivemMatch) {
        return fivemMatch[1].toLowerCase();
    }

    const codeMatch = value.match(
        /^[a-z0-9]{4,32}$/i
    );

    if (codeMatch) {
        return codeMatch[0].toLowerCase();
    }

    return null;
}


function cleanText(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return '';
    }

    return String(value)
        .replace(/\^[0-9]/g, '')
        .replace(/\r/g, '')
        .trim();
}


function safe(value, fallback = 'N/A', max = 1024) {
    const text = cleanText(value);

    if (!text) {
        return fallback;
    }

    return text.length > max
        ? `${text.slice(0, max - 3)}...`
        : text;
}


function arr(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === 'string') {
        return value
            .split(',')
            .map(x => x.trim())
            .filter(Boolean);
    }

    return [];
}


function getEndpoint(server) {
    const endpoints =
        server?.connectedEndpoints ??
        server?.connectEndPoints ??
        server?.endpoints ??
        [];

    if (Array.isArray(endpoints)) {
        const usable = endpoints.find(endpoint => {
            const value = String(endpoint);

            return (
                value &&
                !value.includes('private-placeholder')
            );
        });

        if (usable) {
            return String(usable);
        }
    }

    return (
        server?.connectEndpoint ??
        server?.connectEndPoint ??
        null
    );
}


function formatEndpoint(endpoint) {
    if (!endpoint) {
        return '🔒 Hidden / Private';
    }

    const value = String(endpoint).trim();

    if (
        !value ||
        value.includes('private-placeholder')
    ) {
        return '🔒 Hidden / Private';
    }

    return value;
}


function getPlayers(server) {
    if (
        typeof server?.playersCount === 'number'
    ) {
        return server.playersCount;
    }

    if (
        typeof server?.clients === 'number'
    ) {
        return server.clients;
    }

    if (
        Array.isArray(server?.players)
    ) {
        return server.players.length;
    }

    return 0;
}


function getMaxPlayers(server) {
    return (
        server?.maxPlayers ??
        server?.svMaxClients ??
        server?.sv_maxclients ??
        server?.vars?.sv_maxclients ??
        0
    );
}


function getTags(server) {
    return arr(
        server?.tags ??
        server?.vars?.tags
    )
        .map(x => cleanText(x))
        .filter(Boolean)
        .slice(0, 20);
}


function getResources(server) {
    if (Array.isArray(server?.resources)) {
        return server.resources;
    }

    return [];
}


function getIcon(server) {
    return (
        server?.iconUrl ??
        server?.icon ??
        server?.iconURL ??
        null
    );
}


function getBanner(server) {
    return (
        server?.bannerDetail ??
        server?.banner_detail ??
        server?.bannerConnecting ??
        server?.banner_connecting ??
        null
    );
}


function getProjectName(server) {
    return cleanText(
        server?.projectName ??
        server?.vars?.sv_projectName ??
        ''
    );
}


function getProjectDescription(server) {
    return cleanText(
        server?.projectDesc ??
        server?.projectDescription ??
        server?.vars?.sv_projectDesc ??
        ''
    );
}


function getGameType(server) {
    return cleanText(
        server?.gameType ??
        server?.gametype ??
        server?.vars?.gametype ??
        'N/A'
    );
}


function getMap(server) {
    return cleanText(
        server?.mapName ??
        server?.mapname ??
        server?.vars?.mapname ??
        'N/A'
    );
}


function getLocale(server) {
    return cleanText(
        server?.locale ??
        server?.vars?.locale ??
        'N/A'
    );
}


function getBuild(server) {
    return cleanText(
        server?.build ??
        server?.serverVersion ??
        server?.vars?.sv_enforceGameBuild ??
        'N/A'
    );
}


function getJoinUrl(code, server) {
    return (
        server?.joinUrl ??
        `https://cfx.re/join/${code}`
    );
}


function getAddress(server) {
    const endpoint = getEndpoint(server);

    if (!endpoint) {
        return null;
    }

    return endpoint;
}


// =======================================================
// MAIN COMMAND
// =======================================================

export default {

    name: 'cfxfinder',

    premium: true,

    aliases: [
        'cfxsearch',
        'cekcfx',
        'findcfx'
    ],

    description:
        '🔎 Menampilkan seluruh informasi server CFX.re',

    usage:
        `${config.bot.prefix}cfxfinder <kode_cfx | link>`,

    slashOptions: [
        {
            name: 'kode',
            description:
                'Kode CFX atau link cfx.re/join/xxxxx',
            required: true
        }
    ],

    example:
        `${config.bot.prefix}cfxfinder oax6pvv\n` +
        `${config.bot.prefix}cfxfinder https://cfx.re/join/oax6pvv`,

    cooldown: 8,


    async execute(message, args) {

        // ===================================================
        // PERMISSION
        // ===================================================

        if (
            !message.member?.permissions.has(
                PermissionsBitField.Flags.ManageGuild
            )
        ) {
            return message.reply({
                embeds: [
                    createErrorEmbed(
                        'Akses Ditolak',
                        'Butuh permission **Manage Server** untuk menggunakan CFX Finder.'
                    )
                ]
            });
        }


        // ===================================================
        // ARGUMENT
        // ===================================================

        if (!args?.[0]) {
            return message.reply({
                embeds: [
                    createErrorEmbed(
                        'Kurang Argumen',
                        `**Penggunaan:**\n` +
                        `\`${config.bot.prefix}cfxfinder <kode_cfx | link>\`\n\n` +
                        `**Contoh:**\n` +
                        `• \`${config.bot.prefix}cfxfinder oax6pvv\`\n` +
                        `• \`${config.bot.prefix}cfxfinder https://cfx.re/join/oax6pvv\``
                    )
                ]
            });
        }


        // ===================================================
        // EXTRACT CODE
        // ===================================================

        const code = extractCfxCode(args[0]);

        if (!code) {
            return message.reply({
                embeds: [
                    createErrorEmbed(
                        'Kode Tidak Valid',
                        'Kode CFX tidak dapat dibaca.\n\n' +
                        'Contoh:\n' +
                        '`oax6pvv`\n' +
                        '`https://cfx.re/join/oax6pvv`'
                    )
                ]
            });
        }


        // ===================================================
        // LOADING
        // ===================================================

        const loadingMsg = await message.reply({
            embeds: [
                createLoadingEmbed(
                    `Mengambil **seluruh data CFX** untuk \`${code}\`...`
                )
            ]
        });


        try {

            // =================================================
            // 1. MAIN SERVER DATA
            // =================================================

            const server =
                await servers.single(code);


            if (!server) {

                return loadingMsg.edit({
                    embeds: [
                        createErrorEmbed(
                            'Server Tidak Ditemukan',
                            `Server dengan kode \`${code}\` tidak ditemukan atau sedang offline.`
                        )
                    ],
                    components: []
                });

            }


            // =================================================
            // BASIC
            // =================================================

            const hostname =
                safe(
                    server.hostname ||
                    getProjectName(server) ||
                    code,
                    code,
                    256
                );


            const projectName =
                safe(
                    getProjectName(server),
                    'N/A',
                    256
                );


            const projectDesc =
                safe(
                    getProjectDescription(server),
                    '',
                    900
                );


            const players =
                getPlayers(server);


            const maxPlayers =
                getMaxPlayers(server);


            const endpoint =
                formatEndpoint(
                    getEndpoint(server)
                );


            const gameType =
                safe(
                    getGameType(server),
                    'N/A',
                    100
                );


            const map =
                safe(
                    getMap(server),
                    'N/A',
                    100
                );


            const locale =
                safe(
                    getLocale(server),
                    'N/A',
                    100
                );


            const build =
                safe(
                    getBuild(server),
                    'N/A',
                    100
                );


            const resources =
                getResources(server);


            const tags =
                getTags(server);


            const iconUrl =
                getIcon(server);


            const bannerUrl =
                getBanner(server);


            const joinUrl =
                getJoinUrl(
                    code,
                    server
                );


            // =================================================
            // EXTRA SERVER DATA
            // =================================================

            const serverId =
                safe(
                    server.id,
                    code,
                    200
                );


            const ownerId =
                safe(
                    server.ownerId,
                    'N/A',
                    200
                );


            const ownerName =
                safe(
                    server.ownerName,
                    'N/A',
                    200
                );


            const serverVersion =
                safe(
                    server.serverVersion,
                    'N/A',
                    200
                );


            const game =
                safe(
                    server.game,
                    'FiveM',
                    100
                );


            const project =
                safe(
                    server.projectName,
                    'N/A',
                    256
                );


            const connectedEndpoints =
                Array.isArray(
                    server.connectedEndpoints
                )
                    ? server.connectedEndpoints
                    : [];


            const connectEndpoint =
                safe(
                    server.connectEndpoint,
                    endpoint,
                    300
                );


            const iconVersion =
                safe(
                    server.iconVersion,
                    'N/A',
                    100
                );


            const isFull =
                server.isFull
                    ? '🔴 YES'
                    : '🟢 NO';


            // =================================================
            // EMBED
            // =================================================

            const embed =
                new EmbedBuilder()

                    .setColor(
                        config.colors.primary
                    )

                    .setAuthor({
                        name: '🔎 STRONAUT • CFX FINDER'
                    })

                    .setTitle(
                        hostname
                    )

                    .setDescription(
                        `${SEPARATOR}\n\n` +

                        (
                            projectDesc
                                ? `> ${projectDesc}\n\n`
                                : ''
                        ) +

                        `🆔 **CFX Code:** \`${code}\`\n` +
                        `🌐 **IP:Port:** \`${endpoint}\`\n` +
                        `👥 **Players:** \`${players}/${maxPlayers}\`\n` +
                        `🎮 **Game:** \`${game}\`\n` +
                        `🎮 **Gametype:** \`${gameType}\`\n` +
                        `🗺️ **Map:** \`${map}\`\n` +
                        `📦 **Resources:** \`${resources.length}\`\n` +
                        `🌍 **Locale:** \`${locale}\`\n` +
                        `⚙️ **Build:** \`${build}\`\n` +
                        `🟢 **Full:** \`${isFull}\`\n\n` +

                        `${SEPARATOR}`
                    );


            // =================================================
            // PROJECT
            // =================================================

            embed.addFields({

                name: '🏷️ Project',

                value:
                    `**Name:** ${project}\n` +
                    `**Description:** ${projectDesc || 'N/A'}\n` +
                    `**Version:** ${serverVersion}`,

                inline: false

            });


            // =================================================
            // SERVER ID / OWNER
            // =================================================

            embed.addFields({

                name: '🆔 Server Information',

                value:
                    `**Server ID:** \`${serverId}\`\n` +
                    `**Owner:** \`${ownerName}\`\n` +
                    `**Owner ID:** \`${ownerId}\`\n` +
                    `**Icon Version:** \`${iconVersion}\``,

                inline: false

            });


            // =================================================
            // CONNECTION
            // =================================================

            embed.addFields({

                name: '🌐 Connection',

                value:
                    `**Connect Endpoint:**\n` +
                    `\`${connectEndpoint}\`\n\n` +

                    `**Connected Endpoints:**\n` +
                    (
                        connectedEndpoints.length
                            ? connectedEndpoints
                                .slice(0, 5)
                                .map(x => `\`${x}\``)
                                .join('\n')
                            : '🔒 Hidden / Private'
                    ),

                inline: false

            });


            // =================================================
            // TAGS
            // =================================================

            if (tags.length) {

                embed.addFields({

                    name: '🔖 Tags',

                    value:
                        tags
                            .slice(0, 20)
                            .map(tag =>
                                `\`${safe(tag, '', 50)}\``
                            )
                            .join(' '),

                    inline: false

                });

            }


            // =================================================
            // RESOURCES
            // =================================================

            if (resources.length) {

                const resourceText =
                    resources
                        .slice(0, 30)
                        .map(
                            resource =>
                                `\`${cleanText(resource)}\``
                        )
                        .join(', ');

                embed.addFields({

                    name:
                        `📦 Resources (${resources.length})`,

                    value:
                        resourceText ||
                        'Tidak tersedia',

                    inline: false

                });

            }


            // =================================================
            // ICON
            // =================================================

            if (
                iconUrl &&
                /^https?:\/\//i.test(iconUrl)
            ) {

                embed.setThumbnail(
                    iconUrl
                );

            }


            // =================================================
            // BANNER
            // =================================================

            if (
                bannerUrl &&
                /^https?:\/\//i.test(bannerUrl)
            ) {

                embed.setImage(
                    bannerUrl
                );

            }


            // =================================================
            // FOOTER
            // =================================================

            embed.setFooter({

                text:
                    `${config.bot.name} • CFX.re Server Information`

            });

            embed.setTimestamp();


            // =================================================
            // BUTTONS
            // =================================================

            const row =
                new ActionRowBuilder()
                    .addComponents(

                        new ButtonBuilder()
                            .setLabel(
                                'Join Server'
                            )
                            .setEmoji('🎮')
                            .setStyle(
                                ButtonStyle.Link
                            )
                            .setURL(
                                joinUrl
                            )

                    );


            // =================================================
            // SEND
            // =================================================

            await loadingMsg.edit({

                embeds: [embed],

                components: [row]

            });


            // =================================================
            // OPTIONAL EXTRA FETCH
            // =================================================
            //
            // Kita tampilkan hasil main API terlebih dahulu.
            // Endpoint info/dynamic/players bisa dipanggil
            // jika address tersedia.
            //
            // Tidak mencoba bypass privacy server.
            // =================================================

            const address =
                getAddress(server);


            if (address) {

                try {

                    const [
                        infoData,
                        dynamicData,
                        playerData
                    ] = await Promise.allSettled([

                        servers.info(address),

                        servers.dynamic(address),

                        servers.players(address)

                    ]);


                    console.log(
                        '[CFX Finder] INFO:',
                        infoData.status === 'fulfilled'
                            ? infoData.value
                            : infoData.reason?.message
                    );


                    console.log(
                        '[CFX Finder] DYNAMIC:',
                        dynamicData.status === 'fulfilled'
                            ? dynamicData.value
                            : dynamicData.reason?.message
                    );


                    console.log(
                        '[CFX Finder] PLAYERS:',
                        playerData.status === 'fulfilled'
                            ? Array.isArray(playerData.value)
                                ? playerData.value.length
                                : typeof playerData.value
                            : playerData.reason?.message
                    );

                } catch (extraError) {

                    console.warn(
                        '[CFX Finder] Extra API gagal:',
                        extraError?.message
                    );

                }

            }


        } catch (error) {

            console.error(
                '[CFX Finder]',
                error
            );


            let errorMessage =
                'Gagal mengambil data server dari Cfx.re.';


            if (error?.message) {

                errorMessage +=
                    `\n\n\`${String(
                        error.message
                    ).slice(0, 700)}\``;

            }


            await loadingMsg.edit({

                embeds: [
                    createErrorEmbed(
                        'Gagal Mengambil Data',
                        errorMessage
                    )
                ],

                components: []

            });

        }

    }

};