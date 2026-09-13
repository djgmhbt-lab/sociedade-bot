const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    EmbedBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
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
            .setDescription('Envia o painel interativo de verificação da Sociedade Imperial')
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
});

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
                .setTitle('🎭 Bem-vindo ao sistema de verificação da Sociedade Imperial!')
                .setDescription(
                    '**Atenção:** Siga rigorosamente o processo abaixo para liberar o seu acesso ao servidor.\n\n' +
                    'Escolha uma das opções abaixo no menu para iniciar:\n\n' +
                    '🛡️ **Iniciar 1ª Fase (Registro de Identidade)**\n' +
                    'Informe o seu Nome/RG (obrigatório com underline `_`) e o seu ID na cidade para alterar seu apelido automático e receber o cargo da facção.\n\n' +
                    '🏢 **Iniciar 2ª Fase (Vínculo Empresarial)**\n' +
                    'Caso já tenha feito a 1ª fase, selecione sua empresa para vincular seu cargo secundário (*Mecânica Rodeo*, *FF Veículos* ou *Nenhum*).'
                )
                .setColor(0x0f0f0f)
                .setImage(WELCOME_IMAGE_URL);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_fase_verificacao')
                .setPlaceholder('Selecione a fase de verificação...')
                .addOptions([
                    {
                        label: '1ª Fase: Registrar Identidade (Nome e ID)',
                        description: 'Insira seu RG e ID para atualizar seu apelido e receber o cargo.',
                        value: 'fase_1',
                        emoji: '🛡️'
                    },
                    {
                        label: '2ª Fase: Escolher Empresa / Vínculo',
                        description: 'Selecione sua empresa (Mecânica Rodeo, FF Veículos ou Nenhum).',
                        value: 'fase_2',
                        emoji: '🏢'
                    }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({ content: 'Painel de verificação interativo enviado!', ephemeral: true });
            await interaction.channel.send({ embeds: [embedVerif], components: [row] });
        }
    }

    // Gerencia a escolha do Menu Suspenso principal do painel
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_fase_verificacao') {
        const escolhaFase = interaction.values[0];

        if (escolhaFase === 'fase_1') {
            // Abre o Modal de Nome e ID da 1ª Fase
            const modal = new ModalBuilder()
                .setCustomId('modal_verificacao_fase1')
                .setTitle('1ª Fase - Registro de Identidade');

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
        else if (escolhaFase === 'fase_2') {
            // Abre o menu da 2ª Fase (Empresas) se já tiver passado pela 1ª
            const selectEmpresa = new StringSelectMenuBuilder()
                .setCustomId('select_empresa_verificacao')
                .setPlaceholder('Selecione sua empresa...')
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
                content: `🏢 **2ª Fase de Verificação:** Selecione abaixo a empresa na qual você atua para vincular o seu cargo correspondente:`, 
                components: [row], 
                ephemeral: true 
            });
        }
    }

    // Processa o Modal da 1ª Fase -> Valida o Underline -> Altera apelido e dá o cargo da facção
    if (interaction.isModalSubmit() && interaction.customId === 'modal_verificacao_fase1') {
        const nome = interaction.fields.getTextInputValue('input_nome').trim();
        const idCidade = interaction.fields.getTextInputValue('input_id').trim();
        const member = interaction.member;

        if (!nome.includes('_')) {
            return interaction.reply({ 
                content: `❌ **Verificação negada!** O seu nome no formato RP deve conter obrigatoriamente o underline (\`_\`), seguindo o padrão da cidade (Ex: \`Don_Corleone\`).`, 
                ephemeral: true 
            });
        }

        const novoApelido = `${nome} | ${idCidade}`;
        
        await interaction.deferReply({ ephemeral: true });

        try {
            await member.setNickname(novoApelido);
            await member.roles.add(ROLE_FACCAO_ID);

            // Salva na memória que completou a 1ª fase
            tempVerificationData.set(interaction.user.id, true);

            await interaction.editReply({ 
                content: `✅ **1ª Fase Concluída com Sucesso!**\n\n• Apelido alterado para: **${novoApelido}**\n• Cargo principal atribuído: **Sociedade Imperial**\n\nAgora você já pode ir novamente ao menu principal do painel e escolher a **2ª Fase** para definir sua empresa!` 
            });
        } catch (error) {
            console.error('Erro na 1ª fase:', error);
            await interaction.editReply({ 
                content: `⚠️ Ocorreu um erro ao alterar seu apelido ou atribuir o cargo. Certifique-se de que o cargo do bot está posicionado acima na hierarquia do Discord.` 
            });
        }
    }

    // Processa a escolha da empresa da 2ª Fase
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_empresa_verificacao') {
        const escolha = interaction.values[0];
        const member = interaction.member;
        
        const jaFezPrimeiraFase = tempVerificationData.get(interaction.user.id);

        if (!jaFezPrimeiraFase) {
            return interaction.reply({ content: '❌ Você precisa concluir a **1ª Fase (Registro de Identidade)** antes de escolher a sua empresa!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            let empresaNome = 'Nenhuma (Apenas Facção)';

            if (escolha === 'mecanica_rodeo') {
                await member.roles.add(ROLE_MECANICA_RODEO_ID);
                empresaNome = 'Mecânica Rodeo';
            } else if (escolha === 'ff_veiculos') {
                await member.roles.add(ROLE_FF_VEICULOS_ID);
                empresaNome = 'FF Veículos';
            }

            // Limpa o registro temporário
            tempVerificationData.delete(interaction.user.id);

            await interaction.editReply({ 
                content: `🎉 **Processo de Verificação Concluído 100%!**\n\n• Empresa vinculada: **${empresaNome}**\n• Todos os acessos e cargos foram liberados com sucesso.` 
            });

        } catch (error) {
            console.error('Erro na 2ª fase:', error);
            await interaction.editReply({ 
                content: `⚠️ Ocorreu um erro ao atribuir o cargo da empresa. Verifique a hierarquia de cargos do bot.` 
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
