const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const adapter = new JSONFile('config.db.json');
const db = new Low(adapter);

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot en funcionamiento'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

(async () => {
  await db.read();
db.data ||= {};
db.data.fichajeChannel ||= "";
db.data.bajasChannel ||= "";
db.data.transferChannel ||= "";
db.data.allowedRoles ||= [];
db.data.bajasRoles ||= [];
db.data.transferRoles ||= [];
db.data.precios ||= {};
await db.write();


  client.once('ready', async () => {
    console.log(`Bot conectado como ${client.user.tag}`);
    client.user.setPresence({
      activities: [{ name: '¡Fichajes y Valores! 💰', type: 0 }],
      status: 'online'
    });

    const commands = [
      new SlashCommandBuilder().setName('valor').setDescription('Muestra el valor de un jugador')
        .addUserOption(opt => opt.setName('jugador').setDescription('Jugador a mostrar su valor')),
      new SlashCommandBuilder().setName('subir-precio').setDescription('Sube el valor de un jugador')
        .addUserOption(opt => opt.setName('jugador').setDescription('Jugador al que subir el valor').setRequired(true))
        .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad a subir').setRequired(true)),
      new SlashCommandBuilder().setName('bajar-precio').setDescription('Baja el valor de un jugador')
        .addUserOption(opt => opt.setName('jugador').setDescription('Jugador al que bajar el valor').setRequired(true))
        .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad a bajar').setRequired(true))
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

    await db.read();

    if (commandName === 'valor') {
      const usuario = interaction.options.getUser('jugador') || interaction.user;
      const valor = db.data.valores[usuario.id]?.cantidad || 0;
      const ultima = db.data.valores[usuario.id]?.ultima || 'Sin registro';
      const embed = new EmbedBuilder()
        .setTitle(`Valor de ${usuario.username}`)
        .addFields(
          { name: 'Valor actual', value: `${valor}`, inline: true },
          { name: 'Último cambio', value: ultima, inline: true }
        )
        .setColor('Gold');
      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'subir-precio' || commandName === 'bajar-precio') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Solo administradores pueden modificar valores.', ephemeral: true });
      }

      const jugador = interaction.options.getUser('jugador');
      const cantidad = interaction.options.getInteger('cantidad');

      db.data.valores[jugador.id] ||= { cantidad: 0, ultima: '' };
      if (commandName === 'subir-precio') {
        db.data.valores[jugador.id].cantidad += cantidad;
      } else {
        db.data.valores[jugador.id].cantidad = Math.max(0, db.data.valores[jugador.id].cantidad - cantidad);
      }

      const fecha = new Date();
      const format = `${fecha.getDate().toString().padStart(2, '0')}/${(fecha.getMonth() + 1).toString().padStart(2, '0')}/${fecha.getFullYear()} - ${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')}`;
      db.data.valores[jugador.id].ultima = format;
      await db.write();

      const embed = new EmbedBuilder()
        .setTitle(`Valor actualizado de ${jugador.username}`)
        .addFields(
          { name: 'Nuevo valor', value: `${db.data.valores[jugador.id].cantidad}`, inline: true },
          { name: 'Último cambio', value: format, inline: true }
        )
        .setColor(commandName === 'subir-precio' ? 'Green' : 'Red');

      return interaction.reply({ embeds: [embed] });
    }
  });

  client.login(process.env.TOKEN);
})();
