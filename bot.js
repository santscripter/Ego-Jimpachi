// Requiere las dependencias
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// Base de datos persistente con lowdb v5+
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const adapter = new JSONFile('config.db.json');
const db = new Low(adapter);

// Inicializar cliente de Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Arrancar base de datos y bot
(async () => {
  await db.read();
  db.data ||= {
    fichajeChannel: "",
    bajasChannel: "",
    transferChannel: "",
    allowedRoles: [],
    bajasRoles: [],
    transferRoles: []
  };
  await db.write();

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

  client.login(process.env.TOKEN);

  // Express para mantener el bot activo
  const express = require('express');
  const app = express();
  app.get('/', (req, res) => res.send('Bot en funcionamiento'));
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));
})();
