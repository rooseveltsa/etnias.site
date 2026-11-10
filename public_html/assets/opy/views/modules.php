<?php
if (!function_exists('Etnias_OpyEscape')) {
    require_once dirname(__DIR__) . '/bootstrap.php';
}
$opyModule = isset($route) ? $route : (isset($wo['page']) ? $wo['page'] : '');
$opyHomeUrl = !empty($wo['config']['site_url']) ? Etnias_OpyUrl('home') : '/index.php?link1=home';
?>
<?php if ($opyModule === 'saberes') { ?>
<section class="opy-module" data-opy-module="saberes" aria-labelledby="opy-module-title">
    <header class="opy-module-header">
        <span class="opy-module-badge"><?php echo Etnias_OpyIcon('saberes'); ?><span>Homologação · Educação e Formação</span></span>
        <h1 id="opy-module-title">Saberes e Trilhas de Conhecimento</h1>
        <p>Espaço do Etnias dedicado a cursos comunitários, oficinas, Área do Aluno e conteúdos OnDemand. Nesta etapa de homologação você pode experimentar a inscrição nas trilhas formativas e enviar propostas de cursos ou materiais para a curadoria da equipe.</p>
    </header>

    <div class="opy-module-Callout" role="note">
        <strong>Minha Área do Aluno (Avaliação)</strong>
        <p id="opy-saberes-summary" role="status">Selecione abaixo as trilhas de seu interesse para acompanhar seu painel formativo nesta sessão.</p>
    </div>

    <h2 class="opy-module-subtitle">Trilhas formativas em avaliação</h2>
    <div class="opy-module-grid">
        <article class="opy-module-card" data-saber-card="saberes-comunicacao">
            <div class="opy-module-card-top">
                <span class="opy-module-tag">OnDemand + Encontros</span>
                <span class="opy-module-meta" data-saber-count="saberes-comunicacao">Em avaliação</span>
            </div>
            <h3>Comunicação Comunitária e Mídias Indígenas</h3>
            <p>Produção audiovisual, fotografia autoral, rádio web, narrativa comunitária e gestão segura de redes digitais nos territórios.</p>
            <ul class="opy-module-list">
                <li>Módulo 1: Ética da imagem, autoria coletiva e protocolos de consentimento</li>
                <li>Módulo 2: Captação em campo com celular, áudio e edição acessível</li>
                <li>Módulo 3: Gestão de acervos comunitários e circulação no Etnias</li>
            </ul>
            <div class="opy-module-actions">
                <button type="button" class="opy-secondary-btn" data-saber-enroll="saberes-comunicacao" aria-pressed="false">Inscrever-se na trilha</button>
            </div>
        </article>

        <article class="opy-module-card" data-saber-card="saberes-territorio">
            <div class="opy-module-card-top">
                <span class="opy-module-tag">Trilha Modular</span>
                <span class="opy-module-meta" data-saber-count="saberes-territorio">Em avaliação</span>
            </div>
            <h3>Gestão Territorial, Clima e Monitoramento</h3>
            <p>Ferramentas de cartografia social, leitura de mapas, documentação socioambiental e articulação de redes de proteção territorial.</p>
            <ul class="opy-module-list">
                <li>Módulo 1: Cartografia participativa e memória do território</li>
                <li>Módulo 2: Registro seguro de ocorrências e proteção de dados sensíveis</li>
                <li>Módulo 3: Restauração ecológica, sementes e iniciativas de reflorestamento</li>
            </ul>
            <div class="opy-module-actions">
                <button type="button" class="opy-secondary-btn" data-saber-enroll="saberes-territorio" aria-pressed="false">Inscrever-se na trilha</button>
            </div>
        </article>

        <article class="opy-module-card" data-saber-card="saberes-economia">
            <div class="opy-module-card-top">
                <span class="opy-module-tag">Oficinas Práticas</span>
                <span class="opy-module-meta" data-saber-count="saberes-economia">Em avaliação</span>
            </div>
            <h3>Economia da Floresta e Projetos Culturais</h3>
            <p>Organização de coletivos, elaboração de projetos para editais, precificação justa no Mercado Opy e gestão financeira comunitária.</p>
            <ul class="opy-module-list">
                <li>Módulo 1: Arte, biojoias, grafismos contextualizados e comércio justo</li>
                <li>Módulo 2: Como estruturar campanhas em Coletas e projetos culturais</li>
                <li>Módulo 3: Prestação de contas, logística e parcerias institucionais</li>
            </ul>
            <div class="opy-module-actions">
                <button type="button" class="opy-secondary-btn" data-saber-enroll="saberes-economia" aria-pressed="false">Inscrever-se na trilha</button>
            </div>
        </article>
    </div>

    <section class="opy-module-form-section" aria-labelledby="opy-saberes-form-title">
        <h2 id="opy-saberes-form-title">Propor curso, oficina ou saber</h2>
        <p>Educadores, lideranças, pesquisadores e coletivos podem registrar propostas formativas para avaliação da curadoria do Saberes.</p>
        <form class="opy-module-form" data-opy-module-form="saberes">
            <div class="opy-form-row">
                <label for="saberes-category">Eixo temático
                    <select id="saberes-category" name="category" required>
                        <option value="Línguas, oralidade e memória">Línguas, oralidade e memória</option>
                        <option value="Audiovisual e comunicação comunitária">Audiovisual e comunicação comunitária</option>
                        <option value="Território, clima e meio ambiente">Território, clima e meio ambiente</option>
                        <option value="Artes, música e patrimônio cultural">Artes, música e patrimônio cultural</option>
                        <option value="Gestão de projetos e economia comunitária">Gestão de projetos e economia comunitária</option>
                    </select>
                </label>
                <label for="saberes-community">Povo, comunidade ou organização proponente
                    <input id="saberes-community" name="community" type="text" maxlength="160" placeholder="Ex.: Coletivo de Comunicadores / Povo / Instituição" required>
                </label>
            </div>
            <label for="saberes-title">Título da trilha, oficina ou aula
                <input id="saberes-title" name="title" type="text" maxlength="160" placeholder="Ex.: Oficina de Documentário Comunitário" required>
            </label>
            <label for="saberes-details">Ementa resumida, público-alvo e formato proposto
                <textarea id="saberes-details" name="details" maxlength="2000" placeholder="Descreva os objetivos, módulos sugeridos e se há materiais já gravados ou encontros ao vivo…" required></textarea>
            </label>
            <div class="opy-form-footer">
                <span class="opy-form-hint">Envio de homologação · Avaliado pela curadoria antes de abertura de turmas.</span>
                <button type="submit" class="opy-primary">Registrar proposta no Saberes</button>
            </div>
            <p class="opy-module-feedback" data-opy-module-status role="status" aria-live="polite"></p>
        </form>
    </section>

    <section class="opy-module-submissions" aria-labelledby="opy-saberes-list-title">
        <h2 id="opy-saberes-list-title">Propostas registradas nesta homologação</h2>
        <div data-opy-submissions="saberes" aria-live="polite">
            <p class="opy-module-empty">Nenhuma proposta registrada ainda nesta sessão.</p>
        </div>
    </section>
</section>

<?php } elseif ($opyModule === 'guardiao') { ?>
<section class="opy-module" data-opy-module="guardiao" aria-labelledby="opy-module-title">
    <header class="opy-module-header">
        <span class="opy-module-badge"><?php echo Etnias_OpyIcon('guardiao'); ?><span>Homologação · Monitoramento Socioambiental</span></span>
        <h1 id="opy-module-title">Guardião da Floresta</h1>
        <p>Ferramenta em homologação para estruturar o registro de ocorrências territoriais, ambientais e iniciativas de proteção comunitária no Etnias.</p>
    </header>

    <div class="opy-module-alert" role="region" aria-label="Aviso importante sobre emergências">
        <strong>Importante: este módulo não é um canal de emergência ativo em tempo real</strong>
        <p>Os relatos enviados nesta etapa servem exclusivamente para validação técnica do fluxo pela equipe do projeto. Em caso de incêndio florestal ativo, invasão em andamento ou risco imediato a pessoas e comunidades, acione diretamente os canais oficiais: <strong>Corpo de Bombeiros (193)</strong>, <strong>Defesa Civil (199)</strong>, <strong>IBAMA Linha Verde (0800 061 8080)</strong>, <strong>FUNAI</strong> ou o Ministério Público Federal.</p>
        <p>Para proteger as comunidades, <strong>não publique coordenadas exatas de locais sagrados, moradias ou pontos vulneráveis</strong> em relatos públicos.</p>
    </div>

    <h2 class="opy-module-subtitle">Eixos de monitoramento em avaliação</h2>
    <div class="opy-module-grid opy-module-grid-compact">
        <article class="opy-module-card">
            <span class="opy-module-tag">Prevenção e Clima</span>
            <h3>Queimadas, Seca e Focos de Calor</h3>
            <p>Sistematização de observações locais sobre estiagem, fumaça e áreas de risco para apoiar brigadas comunitárias e planos de prevenção.</p>
        </article>
        <article class="opy-module-card">
            <span class="opy-module-tag">Águas e Biodiversidade</span>
            <h3>Rios, Nascentes e Restauração</h3>
            <p>Acompanhamento da qualidade das águas, assoreamento, pesca predatória e mutirões de reflorestamento e casas de sementes.</p>
        </article>
        <article class="opy-module-card">
            <span class="opy-module-tag">Vigilância Territorial</span>
            <h3>Pressões sobre o Território</h3>
            <p>Protocolo estruturado com controle de visibilidade para documentar impactos socioambientais e encaminhar às organizações parceiras.</p>
        </article>
    </div>

    <section class="opy-module-form-section" aria-labelledby="opy-guardiao-form-title">
        <h2 id="opy-guardiao-form-title">Registrar relato de avaliação</h2>
        <p>Experimente o fluxo de documentação gerando um protocolo de homologação com controle de visibilidade.</p>
        <form class="opy-module-form" data-opy-module-form="guardiao">
            <div class="opy-form-row">
                <label for="guardiao-category">Tipo de registro
                    <select id="guardiao-category" name="category" required>
                        <option value="Queimada, fumaça ou foco de calor">Queimada, fumaça ou foco de calor</option>
                        <option value="Desmatamento ou extração irregular">Desmatamento ou extração irregular</option>
                        <option value="Contaminação de rio, igarapé ou nascente">Contaminação de rio, igarapé ou nascente</option>
                        <option value="Ação comunitária de proteção ou reflorestamento">Ação comunitária de proteção ou reflorestamento</option>
                    </select>
                </label>
                <label for="guardiao-audience">Visibilidade do relato nesta homologação
                    <select id="guardiao-audience" name="audience">
                        <option value="private">Restrito à minha sessão (Recomendado para dados sensíveis)</option>
                        <option value="public">Visível no mural de homologação</option>
                    </select>
                </label>
            </div>
            <div class="opy-form-row">
                <label for="guardiao-community">Região, bacia ou território de referência (sem coordenadas sensíveis)
                    <input id="guardiao-community" name="community" type="text" maxlength="160" placeholder="Ex.: Bacia do Xingu / Região Sul do Amazonas" required>
                </label>
                <label for="guardiao-title">Resumo da observação
                    <input id="guardiao-title" name="title" type="text" maxlength="160" placeholder="Ex.: Monitoramento de nascente comunitária" required>
                </label>
            </div>
            <label for="guardiao-details">Descrição detalhada e encaminhamento sugerido
                <textarea id="guardiao-details" name="details" maxlength="2000" placeholder="Relate o que foi observado, data aproximada e quais coletivos ou órgãos locais acompanham a situação…" required></textarea>
            </label>
            <div class="opy-form-footer">
                <span class="opy-form-hint">Gera protocolo de avaliação · Não substitui denúncia urgente aos órgãos oficiais.</span>
                <button type="submit" class="opy-primary">Gerar protocolo de avaliação</button>
            </div>
            <p class="opy-module-feedback" data-opy-module-status role="status" aria-live="polite"></p>
        </form>
    </section>

    <section class="opy-module-submissions" aria-labelledby="opy-guardiao-list-title">
        <h2 id="opy-guardiao-list-title">Relatos registrados nesta homologação</h2>
        <div data-opy-submissions="guardiao" aria-live="polite">
            <p class="opy-module-empty">Nenhum relato registrado ainda nesta sessão.</p>
        </div>
    </section>
</section>

<?php } elseif ($opyModule === 'fotografos') { ?>
<section class="opy-module" data-opy-module="fotografos" aria-labelledby="opy-module-title">
    <header class="opy-module-header">
        <span class="opy-module-badge"><?php echo Etnias_OpyIcon('fotografos'); ?><span>Homologação · Autoria Visual e Licenciamento</span></span>
        <h1 id="opy-module-title">Fotógrafos Indígenas</h1>
        <p>Diretório autoral de fotógrafos, cinegrafistas e coletivos visuais indígenas. Diferente das fotos publicadas livremente no feed, este espaço organiza portfólios verificados, biografias, créditos de autoria e solicitações de licenciamento ético de imagens.</p>
    </header>

    <div class="opy-module-Callout" role="note">
        <strong>Protocolo de autoria e uso de imagem</strong>
        <p>Toda imagem catalogada exige atribuição explícita de autoria, identificação correta do povo e território e respeito às regras de consentimento comunitário. Nenhum pagamento comercial é cobrado nesta tela de homologação.</p>
    </div>

    <h2 class="opy-module-subtitle">Modalidades do diretório visual</h2>
    <div class="opy-module-grid">
        <article class="opy-module-card">
            <span class="opy-module-tag">Portfólio Autoral</span>
            <h3>Documentação de Território e Cotidiano</h3>
            <p>Ensaios fotográficos produzidos por comunicadores indígenas sobre vida comunitária, arquitetura tradicional, roças, rios e juventude contemporânea.</p>
            <small>Licenciamento previsto: Editorial, educativo e exposições com crédito obrigatório.</small>
        </article>
        <article class="opy-module-card">
            <span class="opy-module-tag">Cobertura Coletiva</span>
            <h3>Encontros, Assembleias e Mobilizações</h3>
            <p>Registros visuais de grandes encontros, festivais culturais, retomadas e conferências climáticas realizados por redes e coletivos de mídia indígena.</p>
            <small>Licenciamento previsto: Imprensa, instituições parceiras e publicações culturais.</small>
        </article>
        <article class="opy-module-card">
            <span class="opy-module-tag">Memória e Acervo</span>
            <h3>Retratos, Arte e Patrimônio Visual</h3>
            <p>Fotografia artística, pintura corporal contextualizada, cerâmica, cestaria e memória histórica com curadoria aprovada pelas comunidades.</p>
            <small>Licenciamento previsto: Catálogos, livros, audiovisual e projetos pedagógicos.</small>
        </article>
    </div>

    <section class="opy-module-form-section" aria-labelledby="opy-fotografos-form-title">
        <h2 id="opy-fotografos-form-title">Cadastrar portfólio ou solicitar licenciamento</h2>
        <p>Fotógrafos e coletivos podem inscrever seu perfil para o catálogo; editoras, veículos e projetos podem testar o pedido de licenciamento.</p>
        <form class="opy-module-form" data-opy-module-form="fotografos">
            <div class="opy-form-row">
                <label for="fotografos-category">Finalidade do registro
                    <select id="fotografos-category" name="category" required>
                        <option value="Cadastro de fotógrafo ou coletivo audiovisual">Cadastro de fotógrafo ou coletivo audiovisual</option>
                        <option value="Solicitação de licenciamento editorial / educativo">Solicitação de licenciamento editorial / educativo</option>
                        <option value="Proposta de exposição ou curadoria conjunta">Proposta de exposição ou curadoria conjunta</option>
                    </select>
                </label>
                <label for="fotografos-community">Povo, coletivo, território ou instituição
                    <input id="fotografos-community" name="community" type="text" maxlength="160" placeholder="Ex.: Coletivo Laklãnõ / Fotógrafo autoral / Editora" required>
                </label>
            </div>
            <label for="fotografos-title">Nome artístico, portfólio ou projeto solicitante
                <input id="fotografos-title" name="title" type="text" maxlength="160" placeholder="Ex.: Ensaio Águas e Florestas — Portfólio Autoral" required>
            </label>
            <label for="fotografos-details">Biografia, especialidades ou detalhes do licenciamento desejado
                <textarea id="fotografos-details" name="details" maxlength="2000" placeholder="Informe sua trajetória visual, equipamentos/temas que trabalha ou a finalidade de uso das imagens solicitadas…" required></textarea>
            </label>
            <div class="opy-form-footer">
                <span class="opy-form-hint">Registro de homologação · Sem transferência de direitos ou cobrança automática.</span>
                <button type="submit" class="opy-primary">Enviar registro para o diretório</button>
            </div>
            <p class="opy-module-feedback" data-opy-module-status role="status" aria-live="polite"></p>
        </form>
    </section>

    <section class="opy-module-submissions" aria-labelledby="opy-fotografos-list-title">
        <h2 id="opy-fotografos-list-title">Perfis e solicitações registrados nesta homologação</h2>
        <div data-opy-submissions="fotografos" aria-live="polite">
            <p class="opy-module-empty">Nenhum portfólio ou solicitação registrado ainda nesta sessão.</p>
        </div>
    </section>
</section>

<?php } elseif ($opyModule === 'musica') { ?>
<section class="opy-module" data-opy-module="musica" aria-labelledby="opy-module-title">
    <header class="opy-module-header">
        <span class="opy-module-badge"><?php echo Etnias_OpyIcon('musica'); ?><span>Homologação · Sonoridades e Créditos Culturais</span></span>
        <h1 id="opy-module-title">Catálogo Musical do Etnias</h1>
        <p>Espaço dedicado a cantos autorizados para difusão pública, música indígena contemporânea (rap, hip-hop, MPB, experimental), paisagens sonoras e fichas técnicas com créditos culturais completos. Para compartilhar uma gravação rápida na conversa diária, você também pode usar o botão Áudio no compositor do feed.</p>
    </header>

    <h2 class="opy-module-subtitle">Estrutura de fichas sonoras em homologação</h2>
    <div class="opy-module-grid">
        <article class="opy-module-card" data-music-card="canto-alvorada">
            <div class="opy-module-card-top">
                <span class="opy-module-tag">Paisagem Sonora · Ensaio</span>
                <span class="opy-module-meta" data-music-count="canto-alvorada">Apoios na sessão</span>
            </div>
            <h3>Frequências da Alvorada (Amostra Técnica)</h3>
            <p>Demonstração do reprodutor de áudio do Etnias com ficha catalográfica, verificação de autoria, língua e licença comunitária.</p>
            <dl class="opy-module-dl">
                <div><dt>Intérprete / Coletivo</dt><dd>Laboratório Sonoro Etnias</dd></div>
                <div><dt>Contexto e Direitos</dt><dd>Áudio sintético de homologação · Uso livre para teste de player</dd></div>
            </dl>
            <div class="opy-module-actions">
                <button type="button" class="opy-secondary-btn" data-music-play="canto-alvorada" data-music-freq="432" aria-pressed="false"><?php echo Etnias_OpyIcon('music'); ?><span>Ouvir amostra sonora</span></button>
                <button type="button" class="opy-secondary-btn" data-music-like="canto-alvorada" aria-pressed="false"><?php echo Etnias_OpyIcon('heart'); ?><span>Apoiar faixa</span></button>
            </div>
        </article>

        <article class="opy-module-card" data-music-card="floresta-viva">
            <div class="opy-module-card-top">
                <span class="opy-module-tag">Contemporâneo · Rap &amp; Voz</span>
                <span class="opy-module-meta" data-music-count="floresta-viva">Apoios na sessão</span>
            </div>
            <h3>Vozes da Juventude e Território (Ficha Modelo)</h3>
            <p>Modelo de catalogação para artistas solo e grupos de rap, trap e canção contemporânea em línguas originárias e português.</p>
            <dl class="opy-module-dl">
                <div><dt>Créditos exigidos</dt><dd>Autoria da letra, beat/instrumentos, povo e tradução autorizada</dd></div>
                <div><dt>Proteção</dt><dd>Vedado uso comercial sem autorização dos titulares</dd></div>
            </dl>
            <div class="opy-module-actions">
                <button type="button" class="opy-secondary-btn" data-music-play="floresta-viva" data-music-freq="528" aria-pressed="false"><?php echo Etnias_OpyIcon('music'); ?><span>Ouvir amostra sonora</span></button>
                <button type="button" class="opy-secondary-btn" data-music-like="floresta-viva" aria-pressed="false"><?php echo Etnias_OpyIcon('heart'); ?><span>Apoiar faixa</span></button>
            </div>
        </article>

        <article class="opy-module-card" data-music-card="memoria-dos-rios">
            <div class="opy-module-card-top">
                <span class="opy-module-tag">Acervo &amp; Oralidade</span>
                <span class="opy-module-meta" data-music-count="memoria-dos-rios">Apoios na sessão</span>
            </div>
            <h3>Cantos e Instrumentos Tradicionais (Ficha Modelo)</h3>
            <p>Modelo de catalogação com governança cultural: distingue registros públicos educativos de cantos rituais restritos que não devem ser publicados.</p>
            <dl class="opy-module-dl">
                <div><dt>Protocolo cultural</dt><dd>Requer indicação de liderança ou detentor do saber musical</dd></div>
                <div><dt>Formato</dt><dd>Áudio sem compressão destrutiva + encarte contextual</dd></div>
            </dl>
            <div class="opy-module-actions">
                <button type="button" class="opy-secondary-btn" data-music-play="memoria-dos-rios" data-music-freq="396" aria-pressed="false"><?php echo Etnias_OpyIcon('music'); ?><span>Ouvir amostra sonora</span></button>
                <button type="button" class="opy-secondary-btn" data-music-like="memoria-dos-rios" aria-pressed="false"><?php echo Etnias_OpyIcon('heart'); ?><span>Apoiar faixa</span></button>
            </div>
        </article>
    </div>

    <section class="opy-module-form-section" aria-labelledby="opy-musica-form-title">
        <h2 id="opy-musica-form-title">Cadastrar artista, canto ou faixa para o catálogo</h2>
        <p>Músicos, intérpretes e coletivos culturais podem submeter a ficha técnica de suas obras para compor o acervo musical do Etnias.</p>
        <form class="opy-module-form" data-opy-module-form="musica">
            <div class="opy-form-row">
                <label for="musica-category">Gênero ou expressão sonora
                    <select id="musica-category" name="category" required>
                        <option value="Música contemporânea (Rap, MPB, Pop, Rock)">Música contemporânea (Rap, MPB, Pop, Rock)</option>
                        <option value="Canto tradicional autorizado para divulgação pública">Canto tradicional autorizado para divulgação pública</option>
                        <option value="Instrumental, maracá, flautas e paisagem sonora">Instrumental, maracá, flautas e paisagem sonora</option>
                        <option value="Podcast, poesia falada e oralidade">Podcast, poesia falada e oralidade</option>
                    </select>
                </label>
                <label for="musica-community">Artista, grupo, povo e língua
                    <input id="musica-community" name="community" type="text" maxlength="160" placeholder="Ex.: Grupo / Povo / Língua materna e Português" required>
                </label>
            </div>
            <label for="musica-title">Título da faixa, álbum ou apresentação
                <input id="musica-title" name="title" type="text" maxlength="160" placeholder="Ex.: Canto das Águas Claras" required>
            </label>
            <label for="musica-details">Ficha técnica, instrumentos, contexto cultural e autorização de difusão
                <textarea id="musica-details" name="details" maxlength="2000" placeholder="Descreva os compositores, participantes, significado público da obra e condições de reprodução na plataforma…" required></textarea>
            </label>
            <div class="opy-form-footer">
                <span class="opy-form-hint">Catalogação em homologação · Respeita os direitos autorais e patrimoniais comunitários.</span>
                <button type="submit" class="opy-primary">Submeter ficha ao Catálogo Musical</button>
            </div>
            <p class="opy-module-feedback" data-opy-module-status role="status" aria-live="polite"></p>
        </form>
    </section>

    <section class="opy-module-submissions" aria-labelledby="opy-musica-list-title">
        <h2 id="opy-musica-list-title">Obras e artistas submetidos nesta homologação</h2>
        <div data-opy-submissions="musica" aria-live="polite">
            <p class="opy-module-empty">Nenhuma ficha musical registrada ainda nesta sessão.</p>
        </div>
    </section>
</section>

<?php } elseif ($opyModule === 'doar') { ?>
<section class="opy-module" data-opy-module="doar" aria-labelledby="opy-module-title">
    <header class="opy-module-header">
        <span class="opy-module-badge"><?php echo Etnias_OpyIcon('heart'); ?><span>Homologação · Apoio Institucional</span></span>
        <h1 id="opy-module-title">Doe para o Etnias</h1>
        <p>Canal institucional dedicado à sustentabilidade do Etnias, formação em tecnologia e comunicação comunitária e fortalecimento de projetos dos povos originários. Este espaço é distinto das campanhas individuais da área Coletas.</p>
    </header>

    <div class="opy-module-Callout" role="note">
        <strong>Transparência e segurança nesta homologação</strong>
        <p>Nenhum pagamento, número de cartão ou transferência bancária é solicitado ou processado nesta tela de homologação. Você pode registrar sua intenção de apoio ou proposta de parceria institucional para validação do fluxo com a equipe do Etnias.</p>
    </div>

    <h2 class="opy-module-subtitle">Frentes apoiadas pelo Etnias</h2>
    <div class="opy-module-grid">
        <article class="opy-module-card">
            <span class="opy-module-tag">Infraestrutura Digital</span>
            <h3>Manutenção do Etnias e Acervo</h3>
            <p>Servidores seguros, armazenamento de mídias da comunidade, desenvolvimento contínuo de acessibilidade e proteção dos dados coletivos.</p>
        </article>
        <article class="opy-module-card">
            <span class="opy-module-tag">Educação e Cultura</span>
            <h3>Bolsas para Educadores e Saberes</h3>
            <p>Remuneração de mestres dos saberes, formadores indígenas, tradução de materiais pedagógicos e produção de trilhas comunitárias.</p>
        </article>
        <article class="opy-module-card">
            <span class="opy-module-tag">Território e Comunicação</span>
            <h3>Equipamentos e Conectividade nas Aldeias</h3>
            <p>Apoio técnico a coletivos de comunicadores, fotógrafos indígenas e redes de monitoramento socioambiental nos territórios.</p>
        </article>
    </div>

    <section class="opy-module-form-section" aria-labelledby="opy-doar-form-title">
        <h2 id="opy-doar-form-title">Registrar intenção de apoio ou parceria</h2>
        <p>Manifeste como você ou sua organização gostaria de apoiar o Etnias quando o gateway oficial for ativado no servidor definitivo.</p>
        <form class="opy-module-form" data-opy-module-form="doar">
            <div class="opy-form-row">
                <label for="doar-category">Modalidade de apoio pretendida
                    <select id="doar-category" name="category" required>
                        <option value="Contribuição mensal recorrente (pessoa física)">Contribuição mensal recorrente (pessoa física)</option>
                        <option value="Contribuição única para projetos (pessoa física)">Contribuição única para projetos (pessoa física)</option>
                        <option value="Parceria institucional, edital ou patrocínio cultural">Parceria institucional, edital ou patrocínio cultural</option>
                        <option value="Doação de equipamentos, conectividade ou apoio técnico">Doação de equipamentos, conectividade ou apoio técnico</option>
                    </select>
                </label>
                <label for="doar-audience">Visibilidade do registro
                    <select id="doar-audience" name="audience">
                        <option value="private">Visível somente na minha sessão</option>
                        <option value="public">Publicar como apoio público na homologação</option>
                    </select>
                </label>
            </div>
            <div class="opy-form-row">
                <label for="doar-community">Nome, organização ou coletivo apoiador
                    <input id="doar-community" name="community" type="text" maxlength="160" placeholder="Ex.: Apoiador individual / Instituto parceiro" required>
                </label>
                <label for="doar-title">Frente prioritária ou referência de apoio
                    <input id="doar-title" name="title" type="text" maxlength="160" placeholder="Ex.: Apoio às trilhas do Saberes e conectividade" required>
                </label>
            </div>
            <label for="doar-details">Mensagem ou proposta de parceria para o Etnias
                <textarea id="doar-details" name="details" maxlength="2000" placeholder="Descreva como deseja contribuir ou deixe seu contato institucional para retorno da equipe…" required></textarea>
            </label>
            <div class="opy-form-footer">
                <span class="opy-form-hint">Sem cobrança financeira nesta etapa · Gera protocolo de intenção de apoio.</span>
                <button type="submit" class="opy-primary">Registrar intenção de apoio</button>
            </div>
            <p class="opy-module-feedback" data-opy-module-status role="status" aria-live="polite"></p>
        </form>
    </section>

    <section class="opy-module-submissions" aria-labelledby="opy-doar-list-title">
        <h2 id="opy-doar-list-title">Manifestações de apoio registradas nesta homologação</h2>
        <div data-opy-submissions="doar" aria-live="polite">
            <p class="opy-module-empty">Nenhuma manifestação registrada ainda nesta sessão.</p>
        </div>
    </section>
</section>
<?php } ?>
<div class="opy-module-back">
    <a href="<?php echo Etnias_OpyEscape($opyHomeUrl); ?>" class="preview-text-link opy-back-link">Voltar ao feed <?php echo Etnias_OpyIcon('arrow'); ?></a>
</div>
