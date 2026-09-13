const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelType, 
    PermissionsBitField 
} = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    AudioPlayerStatus 
} = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;

// CONFIGURAÇÃO DE CANAIS E CARGOS DA SOCIEDADE IMPERIAL
const VOICE_24H_CHANNEL_ID = '1548519077507498044';
const WELCOME_CHANNEL_ID = '1548497517107355759'; // Canal de boas-vindas configurado
const ROLE_FACCAO_ID = '1548475677030883415'; // Cargo principal (Sociedade Imperial)
const ROLE_MECANICA_RODEO_ID = '1548477524474855476'; // Mecânica Rodeo
const ROLE_FF_VEICULOS_ID = '1548506117087297566'; // FF Veículos
const WELCOME_IMAGE_URL = 'https://cdn.discordapp.net/attachments/1548529413715529768/1548529617361445006/9A95656B-B050-4937-9A4A-1F66AE4AD8B9.png?ex=6aa76417&is=6aa61297&hm=780d00c25aa1272979116f723d776d095201fde9f7bb12e1e24ea036b61c75c8';

// Armazenamento temporário dos dados do modal por usuário
const tempVerificationData = new Map();

// Variáveis de áudio para o canal 24h
let audioPlayer = createAudioPlayer();
let currentConnection = null;

client.once('ready', async () => {
    console.log(`Bot online como ${client.user.tag}! Sociedade Imperial operando nas sombras.`);

    const commands = [
        new SlashCommandBuilder()
            .setName('texto')
            .setDescription('Envia uma mensagem personalizada em um canal')
            .addChannelOption(option => 
                option.setName('canal')
                    .setDescription('Canal onde a mensagem será enviada')
                    .setRequired(true))
            .addStringOption(option => 
                option.setName('mensagem')
                    .setDescription('O conteúdo da mensagem')
                    .setRequired(true)),
        
        new SlashCommandBuilder()
            .setName('setup')
            .setDescription('Envia o painel oficial de verificação da Sociedade Imperial')
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Atualizando comandos de barra...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log('Comandos registrados com sucesso!');
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }

    // Conecta no canal de voz 24h após 3 segundos para garantir o cache
    setTimeout(() => {
        connectToBaseVoiceChannel();
    }, 3000);
});

// Função para manter o bot conectado no canal de voz 24h
async function connectToBaseVoiceChannel() {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;

        const channel = await guild.channels.fetch(VOICE_24H_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        currentConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
        });

        currentConnection.subscribe(audioPlayer);
        console.log(`Bot conectado com sucesso ao canal de voz 24h: ${channel.name}`);
    } catch (error) {
        console.error('Erro ao conectar no canal de voz 24h:', error);
    }
}

// Evento de Boas-Vindas Temático com a Imagem
client.on('guildMemberAdd', async member => {
    try {
        const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
        if (!channel) return;

        const embedWelcome = new EmbedBuilder()
            .setTitle('🎭 Novo Membro na Sociedade Imperial')
            .setDescription(`Saudações, ${member}. As portas da alta sociedade e das sombras se abriram para você.\n\nPara transitar em nosso meio com segurança e elegância, dirija-se ao canal de verificação, registre sua identidade na cidade e declare sua lealdade.`)
            .setColor(0x0f0f0f)
            .setImage(WELCOME_IMAGE_URL)
            .setTimestamp();

        await channel.send({ content: `Seja bem-vindo(a) aos domínios da Sociedade Imperial, ${member}!`, embeds: [embedWelcome] });
    } catch (error) {
        console.error('Erro ao enviar mensagem de boas-vindas:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'texto') {
            const channel = interaction.options.getChannel('canal');
            const messageContent = interaction.options.getString('mensagem');

            try {
                await channel.send(messageContent);
                await interaction.reply({ content: `✅ Mensagem enviada com sucesso no canal ${channel}!`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: '❌ Ocorreu um erro ao tentar enviar a mensagem neste canal.', ephemeral: true });
            }
        } 
        
        else if (commandName === 'setup') {
            const embedVerif = new EmbedBuilder()
                .setTitle('🎭 Sociedade Imperial - Verificação Oficial')
                .setDescription('Bem-vindo aos domínios da Sociedade Imperial.\n\nPara iniciar sua identificação, alterar seu apelido e liberar seu acesso, clique no botão abaixo.')
                .setColor(0x0f0f0f)
                .setImage(WELCOME_IMAGE_URL);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_abrir_verificacao')
                    .setLabel('Iniciar Verificação')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🛡️')
            );

            await interaction.reply({ content: 'Painel de verificação enviado!', ephemeral: true });
            await interaction.channel.send({ embeds: [embedVerif], components: [row] });
        }
    }

    // 1. Abre o Modal de Nome e ID
    if (interaction.isButton() && interaction.customId === 'btn_abrir_verificacao') {
        const modal = new ModalBuilder()
            .setCustomId('modal_verificacao')
            .setTitle('Verificação - Sociedade Imperial');

        const nomeInput = new TextInputBuilder()
            .setCustomId('input_nome')
            .setLabel('Nome (RG / Personagem)')
            .setPlaceholder('Ex: Don_Corleone')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const idInput = new TextInputBuilder()
            .setCustomId('input_id')
            .setLabel('ID na Cidade')
            .setPlaceholder('Ex: 123')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nomeInput),
            new ActionRowBuilder().addComponents(idInput)
        );

        await interaction.showModal(modal);
    }

    // 2. Processa o Modal -> Valida o Underline -> Salva e abre o menu de escolha de empresa
    if (interaction.isModalSubmit() && interaction.customId === 'modal_verificacao') {
        const nome = interaction.fields.getTextInputValue('input_nome').trim();
        const idCidade = interaction.fields.getTextInputValue('input_id').trim();

        if (!nome.includes('_')) {
            return interaction.reply({ 
                content: `❌ **Verificação negada!** O seu nome no formato RP deve conter obrigatoriamente o underline (\`_\`), seguindo o padrão da cidade (Ex: \`Don_Corleone\`).`, 
                ephemeral: true 
            });
        }

        const novoApelido = `${nome} | ${idCidade}`;
        
        // Guarda o apelido formatado para usar na próxima etapa
        tempVerificationData.set(interaction.user.id, novoApelido);

        const selectEmpresa = new StringSelectMenuBuilder()
            .setCustomId('select_empresa_verificacao')
            .setPlaceholder('Selecione sua empresa ou escolha Nenhum...')
            .addOptions([
                {
                    label: 'Mecânica Rodeo',
                    description: 'Trabalha na Mecânica Rodeo.',
                    value: 'mecanica_rodeo',
                    emoji: '🔧'
                },
                {
                    label: 'FF Veículos',
                    description: 'Trabalha na FF Veículos.',
                    value: 'ff_veiculos',
                    emoji: '🚗'
                },
                {
                    label: 'Nenhum',
                    description: 'Não trabalha em nenhuma das empresas acima.',
                    value: 'nenhum',
                    emoji: '❌'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectEmpresa);

        await interaction.reply({ 
            content: `✅ Dados iniciais validados com sucesso!\n\n**Segunda Fase:** Selecione abaixo em qual empresa você atua:`, 
            components: [row], 
            ephemeral: true 
        });
    }

    // 3. Processa a escolha da empresa (Segunda Fase)
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_empresa_verificacao') {
        const escolha = interaction.values[0];
        const member = interaction.member;
        const novoApelido = tempVerificationData.get(interaction.user.id);

        if (!novoApelido) {
            return interaction.reply({ content: '❌ Seus dados temporários expiraram. Por favor, clique novamente no botão de verificação.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Altera o apelido e atribui o cargo principal da facção/sociedade
            await member.setNickname(novoApelido);
            await member.roles.add(ROLE_FACCAO_ID);

            let empresaNome = 'Nenhuma (Apenas Facção)';

            // Atribui o cargo correspondente à empresa escolhida (se não for "nenhum")
            if (escolha === 'mecanica_rodeo') {
                await member.roles.add(ROLE_MECANICA_RODEO_ID);
                empresaNome = 'Mecânica Rodeo';
            } else if (escolha === 'ff_veiculos') {
                await member.roles.add(ROLE_FF_VEICULOS_ID);
                empresaNome = 'FF Veículos';
            }

            // Remove da memória temporária
            tempVerificationData.delete(interaction.user.id);

            await interaction.editReply({ 
                content: `🎉 **Verificação Concluída com Sucesso!**\n\n• Apelido alterado para: **${novoApelido}**\n• Cargo principal atribuído: **Sociedade Imperial**\n• Empresa vinculada: **${empresaNome}**\n• Acesso liberado!` 
            });

        } catch (error) {
            console.error('Erro ao processar a verificação completa:', error);
            await interaction.editReply({ 
                content: `⚠️ Ocorreu um erro ao alterar seu apelido ou atribuir os cargos. Certifique-se de que o cargo do bot está posicionado acima desses cargos na hierarquia do Discord.` 
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
