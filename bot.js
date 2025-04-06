// bot.js
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

let config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

client.once('ready', async () => {
    console.log(`Bot conectado como ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: '¡Fichajes! 🏆', type: 0 }],
        status: 'online'
    });

    const commands = [
        new SlashCommandBuilder().setName('set-canal-fichajes').setDescription('Establece el canal de fichajes (admin)'),
        new SlashCommandBuilder().setName('set-roles').setDescription('Establece los roles permitidos')
            .addStringOption(opt => opt.setName('roles').setDescription('Nombres de roles separados por coma').setRequired(true)),
        new SlashCommandBuilder().setName('info-fichador').setDescription('Muestra la configuración actual del fichador'),
        new SlashCommandBuilder().setName('reiniciar-fichajes').setDescription('Reinicia la configuración del fichador (admin)'),
        new SlashCommandBuilder().setName('fichar').setDescription('Inicia un fichaje')
            .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a fichar').setRequired(true))
            .addRoleOption(opt => opt.setName('club').setDescription('Menciona el rol del club').setRequired(true)),
        new SlashCommandBuilder().setName('bajas').setDescription('Remueve a un usuario de un club')
            .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a dar de baja').setRequired(true))
            .addRoleOption(opt => opt.setName('club').setDescription('Rol del club del que será removido').setRequired(true)),
        new SlashCommandBuilder().setName('transferencia').setDescription('Transfiere un usuario de un club a otro')
            .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a transferir').setRequired(true))
            .addRoleOption(opt => opt.setName('club_origen').setDescription('Club de origen').setRequired(true))
            .addRoleOption(opt => opt.setName('club_destino').setDescription('Club de destino').setRequired(true))
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Comandos / registrados correctamente.');
    } catch (error) {
        console.error('Error registrando comandos:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'set-canal-fichajes') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) 
            return interaction.reply({ content: 'Solo los administradores pueden cambiar el canal.', ephemeral: true });
        config.fichajeChannel = interaction.channel.id;
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
        return interaction.reply(`Canal de fichajes configurado a <#${config.fichajeChannel}>`);
    }

    if (commandName === 'set-roles') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) 
            return interaction.reply({ content: 'Solo los administradores pueden configurar roles.', ephemeral: true });
        const roles = interaction.options.getString('roles').split(',').map(r => r.trim());
        const notFound = roles.filter(name => !interaction.guild.roles.cache.find(role => role.name === name));
        if (notFound.length) return interaction.reply({ content: `No se encontraron: ${notFound.join(', ')}`, ephemeral: true });
        config.allowedRoles = roles;
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
        return interaction.reply(`Roles permitidos actualizados: ${roles.join(', ')}`);
    }

    if (commandName === 'info-fichador') {
        return interaction.reply(`Canal de fichajes: ${config.fichajeChannel ? `<#${config.fichajeChannel}>` : 'No configurado'}\nRoles permitidos: ${config.allowedRoles.length ? config.allowedRoles.join(', ') : 'Ninguno'}`);
    }

    if (commandName === 'reiniciar-fichajes') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) 
            return interaction.reply({ content: 'Solo administradores pueden reiniciar.', ephemeral: true });
        config.fichajeChannel = '';
        config.allowedRoles = [];
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
        return interaction.reply('La configuración ha sido reiniciada.');
    }

    if (commandName === 'fichar') {
        const user = interaction.options.getUser('usuario');
        const clubRole = interaction.options.getRole('club');
        const member = interaction.guild.members.cache.get(interaction.member.id);
        const target = interaction.guild.members.cache.get(user.id);

        const roleAllowed = config.allowedRoles.some(name => member.roles.cache.some(r => r.name === name));
        if (!roleAllowed) return interaction.reply({ content: 'No tienes permisos para usar este comando.', ephemeral: true });

        if (!config.fichajeChannel) return interaction.reply({ content: 'Canal de fichajes no configurado.', ephemeral: true });
        const canal = interaction.guild.channels.cache.get(config.fichajeChannel);
        if (!canal) return interaction.reply({ content: 'El canal configurado ya no existe.', ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('Fichaje 📈')
            .setDescription(`Club: ${clubRole.name}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\nUsuario: <@${user.id}>\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n¿Aceptas? ✅`)
            .setColor(0x0099ff);

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('accept')
                .setLabel('✅ Aceptar')
                .setStyle(ButtonStyle.Success)
        );

        const msg = await canal.send({ embeds: [embed], components: [button] });
        await interaction.reply({ content: 'Fichaje enviado al canal.', ephemeral: true });

        const collector = msg.createMessageComponentCollector({ time: 60000 });
        collector.on('collect', async i => {
            if (i.customId === 'accept' && i.user.id === user.id) {
                await i.reply(`${user.username} ha aceptado el fichaje.`);
                collector.stop();
                try {
                    await target.roles.add(clubRole);
                    console.log(`Rol "${clubRole.name}" asignado a ${target.user.username}`);
                } catch (err) {
                    console.error('Error asignando rol:', err);
                }
            } else {
                i.reply({ content: 'No puedes aceptar este fichaje.', ephemeral: true });
            }
        });

        collector.on('end', collected => {
            if (!collected.size) {
                msg.edit({ content: 'Tiempo agotado para aceptar el fichaje.', components: [] });
            }
        });
    }

    if (commandName === 'bajas') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) 
            return interaction.reply({ content: 'Solo administradores pueden usar este comando.', ephemeral: true });

        const user = interaction.options.getUser('usuario');
        const role = interaction.options.getRole('club');
        const member = interaction.guild.members.cache.get(user.id);

        try {
            await member.roles.remove(role);
            await interaction.reply(`${user.username} ha sido dado de baja del club ${role.name}.`);
        } catch (err) {
            console.error(err);
            interaction.reply({ content: 'Error al intentar remover el rol.', ephemeral: true });
        }
    }

    if (commandName === 'transferencia') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) 
            return interaction.reply({ content: 'Solo administradores pueden usar este comando.', ephemeral: true });

        const user = interaction.options.getUser('usuario');
        const clubOrigen = interaction.options.getRole('club_origen');
        const clubDestino = interaction.options.getRole('club_destino');
        const member = interaction.guild.members.cache.get(user.id);

        try {
            await member.roles.remove(clubOrigen);
            await member.roles.add(clubDestino);
            await interaction.reply(`${user.username} ha sido transferido de ${clubOrigen.name} a ${clubDestino.name}.`);
        } catch (err) {
            console.error(err);
            interaction.reply({ content: 'Hubo un error durante la transferencia.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
