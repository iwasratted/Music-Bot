require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType, StringSelectMenuBuilder } = require('discord.js');

const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Discord Music Bot is running!');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Express server running on port ${port}`);
});


const { Manager } = require('erela.js');

const nodes = [{
  host: 'lava-v3.ajieblogs.eu.org',
  port: 80,
  password: 'https://dsc.gg/ajidevserver',
  secure: false,
}];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const manager = new Manager({
  nodes,
  send(id, payload) {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  },
  defaultSearchPlatform: 'youtube',
  autoPlay: true,
  clientName: `${client.user?.username || 'Music Bot'}`,
  plugins: []
});

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Plays a song')
    .addStringOption(option => 
      option.setName('query')
        .setDescription('Song name or URL')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song'),
  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the current song'),
  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip to the next song'),
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current queue'),
  new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show currently playing song'),
  new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the queue'),
  new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Toggle loop mode')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Loop mode')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' }
        )),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a song from the queue')
    .addIntegerOption(option =>
      option.setName('position')
        .setDescription('Position in queue')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a song to a different position')
    .addIntegerOption(option =>
      option.setName('from')
        .setDescription('From position')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('to')
        .setDescription('To position')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('clearqueue')
    .setDescription('Clear the queue'),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stops the music and leaves'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the volume')
    .addIntegerOption(option =>
      option.setName('level')
        .setDescription('Volume level (0-100)')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('247')
    .setDescription('Toggle 24/7 mode'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows all commands'),
  new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get bot invite link'),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Shows bot ping'),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Shows bot statistics'),
  new SlashCommandBuilder()
    .setName('support')
    .setDescription('Join our support server'),

].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  manager.init(client.user.id);

  client.user.setActivity('/help | 24/7 Up For Paraidse', { type: ActivityType.Listening });

  try {
    console.log('Refreshing slash commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered.');
  } catch (error) {
    console.error(error);
  }
});

client.on('raw', (data) => manager.updateVoiceState(data));

function createMusicEmbed(track) {
  return new EmbedBuilder()
    .setTitle('🎵 Now Playing')
    .setDescription(`[${track.title}](${track.uri})`)
    .addFields(
      { name: '👤 Artist', value: track.author, inline: true },
      { name: '⏱️ Duration', value: formatDuration(track.duration), inline: true }
    )
    .setThumbnail(track.thumbnail)
    .setColor('#FF0000');
}

function formatDuration(duration) {
  const minutes = Math.floor(duration / 60000);
  const seconds = ((duration % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds.padStart(2, '0')}`;
}

function createControlButtons() {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('pause')
          .setLabel('Pause/Resume')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('skip')
          .setLabel('Skip')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('stop')
          .setLabel('Stop')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('loop')
          .setLabel('Loop')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('queue')
          .setLabel('Queue')
          .setStyle(ButtonStyle.Secondary)
      )
  ];
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand() && !interaction.isButton() && !interaction.isStringSelectMenu()) return;

  if (interaction.isButton()) {
    if (!interaction.member.voice.channel) {
      return interaction.reply({ content: 'You need to join a voice channel to use the buttons!', ephemeral: true });
    }
    const player = manager.players.get(interaction.guild.id);
    if (!player) return;

    const currentTrack = player.queue.current;
    if (!currentTrack) return;

    if (currentTrack.requester.id !== interaction.user.id) {
      return interaction.reply({ content: 'Only the person who requested this song can use these buttons!', ephemeral: true });
    }

    switch (interaction.customId) {
      case 'pause':
        player.pause(!player.paused);
        await interaction.reply({ content: player.paused ? 'Paused' : 'Resumed', ephemeral: true });
        break;
      case 'skip':
        const skipMessage = player.get('currentMessage');
        if (skipMessage && skipMessage.editable) {
          const disabledButtons = skipMessage.components[0].components.map(button => {
            return ButtonBuilder.from(button).setDisabled(true);
          });
          skipMessage.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
        }
        if (player.queue.length === 0) {
          const queueEndEmbed = new EmbedBuilder()
            .setDescription('Queue has ended!')
            .setColor('#FF0000')
            .setTimestamp();
          await interaction.channel.send({ embeds: [queueEndEmbed] });
          player.set('manualStop', true);
        }
        player.stop();
        await interaction.reply({ content: 'Skipped', ephemeral: true });
        break;
      case 'stop':
        const stopMessage = player.get('currentMessage');
        if (stopMessage && stopMessage.editable) {
          const disabledButtons = stopMessage.components[0].components.map(button => {
            return ButtonBuilder.from(button).setDisabled(true);
          });
          stopMessage.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
        }
        player.set('manualStop', true);
        const stopEmbed = new EmbedBuilder()
          .setDescription('Queue has ended!')
          .setColor('#FF0000')
          .setTimestamp();
        await interaction.channel.send({ embeds: [stopEmbed] });
        player.destroy();
        await interaction.reply({ content: 'Stopped', ephemeral: true });
        break;
      case 'loop':
        player.setQueueRepeat(!player.queueRepeat);
        await interaction.reply({ content: `Loop: ${player.queueRepeat ? 'Enabled' : 'Disabled'}`, ephemeral: true });
        break;
      case 'queue':
        const queue = player.queue;
        const currentTrack = player.queue.current;
        let description = queue.length > 0 ? queue.map((track, i) => 
          `${i + 1}. [${track.title}](${track.uri})`).join('\n') : 'No songs in queue';

        if (currentTrack) description = `**Now Playing:**\n[${currentTrack.title}](${currentTrack.uri})\n\n**Queue:**\n${description}`;

        const embed = new EmbedBuilder()
          .setTitle('Queue')
          .setDescription(description)
          .setColor('#FF0000')
          .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
    }
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'filter') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return;

    const filter = interaction.values[0];
    player.node.send({
      op: 'filters',
      guildId: interaction.guild.id,
      [filter]: true
    });

    const embed = new EmbedBuilder()
      .setDescription(`🎵 Applied filter: ${filters[filter]}`)
      .setColor('#FF0000')
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  const { commandName, options } = interaction;

  if (commandName === 'play') {
    if (!interaction.member.voice.channel) {
      return interaction.reply({ content: 'Join a voice channel first!', ephemeral: true });
    }

    const player = manager.create({
      guild: interaction.guild.id,
      voiceChannel: interaction.member.voice.channel.id,
      textChannel: interaction.channel.id,
      selfDeafen: true
    });

    if (!player.twentyFourSeven) player.twentyFourSeven = false;

    player.connect();

    const query = options.getString('query');
    const res = await manager.search(query, interaction.user);

    switch (res.loadType) {
      case 'TRACK_LOADED':
      case 'SEARCH_RESULT':
        if (!res.tracks || res.tracks.length === 0) {
          await interaction.reply({ content: 'No results found! Please try a different search term.', ephemeral: true });
          return;
        }
        const track = res.tracks[0];
        player.queue.add(track);
        const embed = new EmbedBuilder()
          .setDescription(`Added [${track.title}](${track.uri}) to the queue`)
          .setColor('#FF0000')
          .setFooter({ 
            text: `Requested by ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        if (!player.playing && !player.paused) player.play();
        break;
      case 'NO_MATCHES':
        await interaction.reply({ content: 'No results found! Please try a different search term.', ephemeral: true });
        break;
      case 'LOAD_FAILED':
        await interaction.reply({ content: 'Failed to load track! Please try again or use a different link.', ephemeral: true });
        break;
    }
  }

  if (commandName === 'pause') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

    player.pause(true);
    const embed = new EmbedBuilder()
      .setDescription('⏸️ Paused')
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'resume') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

    player.pause(false);
    const embed = new EmbedBuilder()
      .setDescription('▶️ Resumed')
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'skip') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

    player.stop();
    const embed = new EmbedBuilder()
      .setDescription('⏭️ Skipped')
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'queue') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

    const queue = player.queue;
    const currentTrack = player.queue.current;
    let description = queue.length > 0 ? queue.map((track, i) => 
      `${i + 1}. [${track.title}](${track.uri})`).join('\n') : 'No songs in queue';

    if (currentTrack) description = `**Now Playing:**\n[${currentTrack.title}](${currentTrack.uri})\n\n**Queue:**\n${description}`;

    const embed = new EmbedBuilder()
      .setTitle('🎵 Queue')
      .setDescription(description)
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'nowplaying') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

    const track = player.queue.current;
    if (!track) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

    const embed = createMusicEmbed(track);
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'shuffle') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

    player.queue.shuffle();
    const embed = new EmbedBuilder()
      .setDescription('🔀 Shuffled the queue')
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'loop') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

    const mode = options.getString('mode');
    switch (mode) {
      case 'off':
        player.setQueueRepeat(false);
        player.setTrackRepeat(false);
        break;
      case 'track':
        player.setQueueRepeat(false);
        player.setTrackRepeat(true);
        break;
      case 'queue':
        player.setQueueRepeat(true);
        player.setTrackRepeat(false);
        break;
    }

    const embed = new EmbedBuilder()
      .setDescription(`🔄 Loop mode set to: ${mode}`)
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'remove') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

    const pos = options.getInteger('position') - 1;
    if (pos < 0 || pos >= player.queue.length) {
      return interaction.reply({ content: 'Invalid position!', ephemeral: true });
    }

    const removed = player.queue.remove(pos);
    const embed = new EmbedBuilder()
      .setDescription(`❌ Removed [${removed.title}](${removed.uri})`)
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'move') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

    const from = options.getInteger('from') - 1;
    const to = options.getInteger('to') - 1;

    if (from < 0 || from >= player.queue.length || to < 0 || to >= player.queue.length) {
      return interaction.reply({ content: 'Invalid position!', ephemeral: true });
    }

    const track = player.queue[from];
    player.queue.remove(from);
    player.queue.add(track, to);

    const embed = new EmbedBuilder()
      .setDescription(`📦 Moved [${track.title}](${track.uri}) to position ${to + 1}`)
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'clearqueue') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

    player.queue.clear();
    const embed = new EmbedBuilder()
      .setDescription('🗑️ Cleared the queue')
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'stop') {
    const player = manager.players.get(interaction.guild.id);
    if (player) {
      player.set('manualStop', true);
      const stopMessage = player.get('currentMessage');
      if (stopMessage && stopMessage.editable) {
        const disabledButtons = stopMessage.components[0].components.map(button => {
          return ButtonBuilder.from(button).setDisabled(true);
        });
        stopMessage.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
      }
      const stopEmbed = new EmbedBuilder()
        .setDescription('Queue has ended!')
        .setColor('#FF0000')
        .setTimestamp();
      await interaction.channel.send({ embeds: [stopEmbed] });
      player.destroy();
      await interaction.reply({ content: '⏹️ Stopped the music and left', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Not playing anything!', ephemeral: true });
    }
  }

  if (commandName === 'volume') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

    const volume = options.getInteger('level');
    if (volume < 0 || volume > 100) {
      return interaction.reply({ content: 'Volume must be between 0 and 100!', ephemeral: true });
    }

    player.setVolume(volume);
    await interaction.reply(`🔊 Volume set to ${volume}%`);
  }

  if (commandName === '247') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'No music is playing!', ephemeral: true });

    player.twentyFourSeven = !player.twentyFourSeven;
    const embed = new EmbedBuilder()
      .setDescription(`🎵 24/7 mode is now ${player.twentyFourSeven ? 'enabled' : 'disabled'}`)
      .setColor('#FF0000')
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setTitle(`🎵 ${client.user.username} Commands`)
      .setDescription('Your ultimate music companion with high-quality playback!')
      .addFields(
        { name: '🎵 Music Controls', value: 
          '`/play` - Play a song from name/URL\n' +
          '`/pause` - ⏸️ Pause current playback\n' +
          '`/resume` - ▶️ Resume playback\n' +
          '`/stop` - ⏹️ Stop and disconnect\n' +
          '`/skip` - ⏭️ Skip to next song\n' +
          '`/volume` - 🔊 Adjust volume (0-100)'
        },
        { name: '📑 Queue Management', value: 
          '`/queue` - 📜 View current queue\n' +
          '`/nowplaying` - 🎵 Show current track\n' +
          '`/shuffle` - 🔀 Shuffle the queue\n' +
          '`/loop` - 🔁 Set loop mode\n' +
          '`/remove` - ❌ Remove a song\n' +
          '`/move` - ↕️ Move track position'
        },
        { name: '⚙️ Utility', value: 
          '`/247` - 🔄 Toggle 24/7 mode\n' +
          '`/ping` - 📡 Check latency\n' +
          '`/stats` - 📊 View statistics\n' +
          '`/invite` - 📨 Invite bot to server\n' +
          '`/support` - 💬 Join support server'
        }
      )
      .setColor('#FF0000')
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ 
        text: `Made By KarmaIzLove • Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    return await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'invite') {
    const embed = new EmbedBuilder()
      .setTitle('📨 Invite Me')
      .setDescription(`[Click here to invite me to your server]()`)
      .setColor('#FF0000')
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'ping') {
    const ping = Math.round(client.ws.ping);
    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setDescription(`WebSocket Ping: ${ping}ms`)
      .setColor('#FF0000')
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }



  if (commandName === 'stats') {
    const uptime = Math.round(client.uptime / 1000);
    const seconds = uptime % 60;
    const minutes = Math.floor((uptime % 3600) / 60);
    const hours = Math.floor((uptime % 86400) / 3600);
    const days = Math.floor(uptime / 86400);

    const embed = new EmbedBuilder()
      .setTitle('📊 Bot Statistics')
      .addFields(
        { name: '⌚ Uptime', value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: true },
        { name: '🎵 Active Players', value: `${manager.players.size}`, inline: true },
        { name: '🌐 Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: '👥 Users', value: `${client.users.cache.size}`, inline: true },
        { name: '📡 Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true }
      )
      .setColor('#FF0000')
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'support') {
    const embed = new EmbedBuilder()
      .setTitle('💬 Support Server')
      .setDescription(`[Click here to join our support server](${process.env.SUPPORT_SERVER})`)
      .setColor('#FF0000')
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
});

manager.on('nodeConnect', (node) => {
  console.log(`Node ${node.options.identifier} connected`);
});

manager.on('nodeError', (node, error) => {
  console.error(`Node ${node.options.identifier} error:`, error.message);
});

manager.on('trackStart', (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) {
    const embed = createMusicEmbed(track);
    const buttons = createControlButtons();
    channel.send({ embeds: [embed], components: buttons }).then(msg => {
      player.set('currentMessage', msg);
    });
  }
});

manager.on('queueEnd', (player) => {
  if (player.get('manualStop')) return;

  const channel = client.channels.cache.get(player.textChannel);
  if (channel) {
    const embed = new EmbedBuilder()
      .setDescription('Queue has ended!')
      .setColor('#FF0000')
      .setTimestamp();
    channel.send({ embeds: [embed] });

    const message = player.get('currentMessage');
    if (message && message.editable) {
      const disabledButtons = message.components[0].components.map(button => {
        return ButtonBuilder.from(button).setDisabled(true);
      });
      message.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
