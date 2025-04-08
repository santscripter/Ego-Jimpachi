// Requiere las dependencias
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// Crear cliente
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Cargar configuración
let config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

client.once('ready', async () => {
  console.log(`Bot conectado como ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: '¡Fichajes! 🏆', type: 0 }],
    status: 'online'
  });

  const commands = [
    new SlashCommandBuilder().setName('set-canal-fichajes').setDescription('Establece el canal de fichajes (admin)'),
    new SlashCommandBuilder().setName('set-canal-bajas').setDescription('Establece el canal de bajas (admin)'),
    new SlashCommandBuilder().setName('set-canal-transferencia').setDescription('Establece el canal de transferencias (admin)'),
    new SlashCommandBuilder().setName('set-roles').setDescription('Establece los roles permitidos')
      .addStringOption(opt => opt.setName('roles').setDescription('Nombres de roles separados por coma').setRequired(true)),
    new SlashCommandBuilder().setName('set-roles-bajas').setDescription('Establece roles permitidos para bajas')
      .addStringOption(opt => opt.setName('roles').setDescription('Nombres de roles separados por coma').setRequired(true)),
    new SlashCommandBuilder().setName('set-roles-transferencia').setDescription('Establece roles permitidos para transferencias')
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
  if (interaction.isButton()) {
    const id = interaction.customId;
    if (id.startsWith('confirmar_')) {
      if (interaction.user.id !== id.split('_')[1]) {
        return interaction.reply({ content: 'Solo el fichado puede confirmar.', ephemeral: true });
      }
      await interaction.reply({ content: '¡Fichaje confirmado! ✅', ephemeral: true });
    }
  }

  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  const guardarRoles = (clave, rolesStr) => {
    const roles = rolesStr.split(',').map(r => r.trim());
    const notFound = roles.filter(name => !interaction.guild.roles.cache.find(role => role.name === name));
    if (notFound.length) return `No se encontraron: ${notFound.join(', ')}`;
    config[clave] = roles;
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    return null;
  };

  if (commandName === 'set-canal-fichajes') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Solo los administradores pueden cambiar el canal.', ephemeral: true });
    config.fichajeChannel = interaction.channel.id;
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    return interaction.reply(`Canal de fichajes configurado a <#${config.fichajeChannel}>`);
  }

  if (commandName === 'set-canal-bajas') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Solo los administradores pueden cambiar el canal.', ephemeral: true });
    config.bajasChannel = interaction.channel.id;
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    return interaction.reply(`Canal de bajas configurado a <#${config.bajasChannel}>`);
  }

  if (commandName === 'set-canal-transferencia') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Solo los administradores pueden cambiar el canal.', ephemeral: true });
    config.transferChannel = interaction.channel.id;
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    return interaction.reply(`Canal de transferencias configurado a <#${config.transferChannel}>`);
  }

  if (commandName === 'set-roles') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Solo los administradores pueden configurar roles.', ephemeral: true });
    const err = guardarRoles('allowedRoles', interaction.options.getString('roles'));
    if (err) return interaction.reply({ content: err, ephemeral: true });
    return interaction.reply('Roles permitidos actualizados.');
  }

  if (commandName === 'set-roles-bajas') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Solo los administradores pueden configurar roles.', ephemeral: true });
    const err = guardarRoles('bajasRoles', interaction.options.getString('roles'));
    if (err) return interaction.reply({ content: err, ephemeral: true });
    return interaction.reply('Roles permitidos para bajas actualizados.');
  }

  if (commandName === 'set-roles-transferencia') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Solo los administradores pueden configurar roles.', ephemeral: true });
    const err = guardarRoles('transferRoles', interaction.options.getString('roles'));
    if (err) return interaction.reply({ content: err, ephemeral: true });
    return interaction.reply('Roles permitidos para transferencias actualizados.');
  }

  if (commandName === 'info-fichador') {
    return interaction.reply(`Canal de fichajes: ${config.fichajeChannel ? `<#${config.fichajeChannel}>` : 'No configurado'}\nRoles fichajes: ${config.allowedRoles?.join(', ') || 'Ninguno'}\nRoles bajas: ${config.bajasRoles?.join(', ') || 'Ninguno'}\nRoles transferencia: ${config.transferRoles?.join(', ') || 'Ninguno'}`);
  }

  if (commandName === 'fichar') {
    const usuario = interaction.options.getUser('usuario');
    const club = interaction.options.getRole('club');
    const miembro = interaction.guild.members.cache.get(usuario.id);
    if (!miembro) return interaction.reply({ content: 'El usuario no está en el servidor.', ephemeral: true });

    const tienePermiso = config.allowedRoles?.some(roleName => interaction.member.roles.cache.some(r => r.name === roleName));
    if (!tienePermiso) return interaction.reply({ content: 'No tienes permiso para fichar.', ephemeral: true });

    await miembro.roles.add(club.id);

    const boton = new ButtonBuilder()
      .setCustomId(`confirmar_${usuario.id}`)
      .setLabel('✅ Confirmar')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(boton);

    const canal = interaction.guild.channels.cache.get(config.fichajeChannel);
    if (canal) canal.send({
      content: `**${usuario.tag}** ha sido fichado por **${club.name}**.`,
      components: [row]
    });

    return interaction.reply({ content: `El usuario fue fichado en ${club.name}.`, ephemeral: true });
  }

  if (commandName === 'bajas') {
    const usuario = interaction.options.getUser('usuario');
    const club = interaction.options.getRole('club');
    const miembro = interaction.guild.members.cache.get(usuario.id);
    if (!miembro) return interaction.reply({ content: 'El usuario no está en el servidor.', ephemeral: true });

    const tienePermiso = config.bajasRoles?.some(roleName => interaction.member.roles.cache.some(r => r.name === roleName));
    if (!tienePermiso) return interaction.reply({ content: 'No tienes permiso para dar de baja.', ephemeral: true });

    if (!miembro.roles.cache.has(club.id)) {
      return interaction.reply({ content: 'Ese usuario no pertenece a ese club.', ephemeral: true });
    }

    await miembro.roles.remove(club.id);
    const canal = interaction.guild.channels.cache.get(config.bajasChannel);
    if (canal) canal.send(`**${usuario.tag}** ha sido dado de baja del club **${club.name}**.`);
    return interaction.reply({ content: `El usuario fue dado de baja de ${club.name}.`, ephemeral: true });
  }

  if (commandName === 'transferencia') {
    const usuario = interaction.options.getUser('usuario');
    const clubOrigen = interaction.options.getRole('club_origen');
    const clubDestino = interaction.options.getRole('club_destino');
    const miembro = interaction.guild.members.cache.get(usuario.id);
    if (!miembro) return interaction.reply({ content: 'El usuario no está en el servidor.', ephemeral: true });

    const tienePermiso = config.transferRoles?.some(roleName => interaction.member.roles.cache.some(r => r.name === roleName));
    if (!tienePermiso) return interaction.reply({ content: 'No tienes permiso para hacer transferencias.', ephemeral: true });

    if (!miembro.roles.cache.has(clubOrigen.id)) {
      return interaction.reply({ content: 'Ese usuario no pertenece al club de origen.', ephemeral: true });
    }

    await miembro.roles.remove(clubOrigen.id);
    await miembro.roles.add(clubDestino.id);

    const canal = interaction.guild.channels.cache.get(config.transferChannel);
    if (canal) canal.send(`**${usuario.tag}** ha sido transferido de **${clubOrigen.name}** a **${clubDestino.name}**.`);
    return interaction.reply({ content: `El usuario fue transferido correctamente.`, ephemeral: true });
  }
});

client.login(process.env.TOKEN);

// Express y ping automático
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot en funcionamiento'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));
setInterval(() => require('http').get(`http://localhost:${PORT}`), 220000);

// Manejadores de errores
process.on('warning', (warning) => {
  if (!warning.message.includes('ephemeral')) console.warn(warning);
});

process.on('unhandledRejection', err => {
  console.error('Unhandled promise rejection:', err);
});

process.on('uncaughtException', err => {
  console.error('Uncaught exception:', err);
});