(function () {
  "use strict";

  const config = window.EXPERIMENT_CONFIG || {};
  const app = document.getElementById("app");
  const exitDialog = document.getElementById("exit-dialog");

  const bsriItems = [
    "此时此刻，我反复思虑自己的负面情绪。",
    "此时此刻，我想知道我为什么会反复思虑负面情绪。",
    "此时此刻，我很难摆脱自己的负面想法。",
    "此时此刻，我正在脑海里反复回想最近说或做过的事情。",
    "此时此刻，我在想“为什么我不能更好地处理事情？”",
    "此时此刻，我很难摆脱负面情绪。",
    "此时此刻，我正在想“面对负面情绪为什么我只能反复思虑它？”",
    "此时此刻，我正在想“为什么我总是如此？”",
  ];

  const commonUsabilityItems = [
    "这个页面的功能满足了我完成本次文字任务的需要。",
    "这个页面易于使用。",
    "页面上的说明清楚易懂。",
    "在任务过程中，我一直知道下一步需要做什么。",
    "页面让我能够按照合适的节奏完成任务。",
    "技术问题影响了我完成任务。",
  ];

  const aiExperienceItems = [
    "页面回应与我刚才表达的内容有关。",
    "页面能够承接我在前面已经说过的信息。",
    "对话中的提问出现了不必要的重复。",
    "我能够决定表达多少内容以及何时结束。",
  ];

  const writingExperienceItems = [
    "四个书写提示与本次任务有关。",
    "不同提示之间有不必要的重复。",
    "12 分钟的书写时间对我来说合适。",
    "我能够决定表达多少内容以及何时结束。",
  ];

  const state = {
    participantId: "",
    currentScreen: "home",
    condition: null,
    event: {
      label: "",
      summary: "",
      coreThought: "",
    },
    pretest: {},
    posttest: {},
    messages: [],
    writing: {},
    timerId: null,
    secondsRemaining: Number(config.TASK_DURATION_SECONDS) || 720,
    previewMode: false,
  };

  const screenStage = {
    consent: 1,
    event: 2,
    "bsri-pre": 2,
    "event-pre": 2,
    assigning: 2,
    chat: 3,
    writing: 3,
    "bsri-post": 4,
    "event-post": 4,
    usability: 4,
    complete: 5,
    support: 5,
    withdrawn: 5,
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isLocalPreview() {
    return (
      config.ENABLE_LOCAL_PREVIEW &&
      (window.location.protocol === "file:" ||
        ["localhost", "127.0.0.1"].includes(window.location.hostname))
    );
  }

  function apiUrl(endpoint) {
    const base = String(config.API_BASE || "").replace(/\/$/, "");
    return `${base}${endpoint}`;
  }

  async function apiRequest(endpoint, payload) {
    const response = await fetch(apiUrl(endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`请求失败 ${response.status}`);
    }

    return response.json();
  }

  function renderHeader(showParticipant = true) {
    const participant =
      showParticipant && state.participantId
        ? `<span class="participant-pill">参与者编号 ${escapeHtml(state.participantId)}</span>`
        : "";

    return `
      <header class="site-header">
        <div class="site-header__inner">
          <div class="brand" aria-label="近期事件回忆与文字表达研究">
            <span class="brand__mark" aria-hidden="true"></span>
            <span class="brand__text">近期事件回忆与文字表达研究</span>
          </div>
          ${participant}
        </div>
      </header>
    `;
  }

  function renderProgress(stage) {
    const stages = ["知情同意", "前测", "文字任务", "后测", "完成"];
    const progress = ((stage - 1) / (stages.length - 1)) * 100;
    return `
      <div class="progress-wrap" aria-label="实验进度">
        <div class="progress-track">
          <div class="progress-fill" style="--progress: ${progress}%"></div>
        </div>
        <div class="progress-labels">
          ${stages
            .map(
              (label, index) =>
                `<span class="${index + 1 === stage ? "is-current" : ""}">${label}</span>`,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderShell(content, options = {}) {
    const { home = false, hideProgress = false, participant = true } = options;
    const stage = screenStage[state.currentScreen] || 1;
    app.innerHTML = `
      <div class="shell">
        ${renderHeader(participant)}
        ${hideProgress ? "" : renderProgress(stage)}
        <main class="main ${home ? "main--home" : ""}" id="main-content">
          ${content}
        </main>
      </div>
    `;
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function showError(message, id = "page-error") {
    const error = document.getElementById(id);
    if (!error) return;
    error.textContent = message;
    error.classList.add("is-visible");
    error.setAttribute("role", "alert");
  }

  function navigate(screen) {
    clearTaskTimer();
    state.currentScreen = screen;
    renderCurrentScreen();
  }

  function renderHome() {
    renderShell(
      `
        <section class="hero">
          <div class="hero__visual">
            <img
              class="hero__image"
              src="assets/hero-reflection.png"
              alt="柔和色块与线条组成的抽象画面"
            />
            <div class="hero__caption">
              <span>文字研究 · 匿名编号参与</span>
              <span>研究用途</span>
            </div>
          </div>
          <div class="hero__content">
            <p class="eyebrow">大学生毕业研究</p>
            <h1>留一点时间，看看此刻的想法</h1>
            <p class="lead">
              你将回想一件近期发生的日常事件，完成简短问卷，并进行一次约 12 分钟的文字任务。
            </p>
            <div class="hero__meta" aria-label="实验信息">
              <span>全程约 25 至 30 分钟</span>
              <span>可随时退出</span>
              <span>不提供诊断或治疗</span>
            </div>
            <form id="start-form">
              <div class="form-field">
                <label class="form-label" for="participant-id">参与者编号</label>
                <input
                  class="text-input"
                  id="participant-id"
                  name="participant-id"
                  type="text"
                  autocomplete="off"
                  maxlength="32"
                  required
                  placeholder="请输入研究者提供的编号"
                />
                <p class="form-hint">请勿填写姓名、学号、手机号或其他身份信息。</p>
              </div>
              <div class="button-row">
                <button class="button button--primary button--wide" type="submit">
                  开始实验
                </button>
              </div>
              <p class="tiny-note">点击后将先进入知情同意页面，正式开始前仍可决定不参加。</p>
            </form>
          </div>
        </section>
      `,
      { home: true, hideProgress: true, participant: false },
    );

    document.getElementById("start-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.getElementById("participant-id");
      const participantId = input.value.trim();
      if (!participantId) {
        input.focus();
        return;
      }
      state.participantId = participantId;
      navigate("consent");
    });
  }

  function renderConsent() {
    renderShell(`
      <div class="page-title">
        <p class="eyebrow">第一步</p>
        <h2>实验知情同意书</h2>
        <p class="lead">请完整阅读以下内容。若有疑问，可以在决定前询问研究人员。</p>
      </div>
      <div class="page-grid page-grid--wide">
        <section class="card" aria-labelledby="consent-title">
          <div class="card__body">
            <div class="consent-document" id="consent-document" tabindex="0">
              <p>尊敬的参与者：</p>
              <p>您好！感谢您关注并考虑参加本研究。在您决定是否参加之前，请仔细阅读以下内容。研究人员将向您说明本研究的目的、流程、可能的风险与收益、数据处理方式以及您的相关权利。若您对任何内容存在疑问，可在决定是否参加前向研究人员提出。</p>
              <p>请您在充分理解本说明并自愿同意后参加本研究。</p>

              <h3 id="consent-title">研究简介</h3>
              <p>本研究旨在开发和初步验证一款基于大语言模型的文字对话工具，用于帮助大学生在受到日常负面事件反复困扰时，对相关想法进行表达、观察和整理。</p>
              <p>研究主要关注日常生活中的负面事件，例如学业或工作受挫、普通人际冲突、社交尴尬、一般失败、后悔或自我批评等。</p>
              <p>除问卷和文字互动外，本研究还将使用生理多导仪记录实验过程中的部分生理信号，包括心电、皮电和呼吸等，用于了解参与者在不同实验阶段中的生理唤醒和恢复变化。相关生理信号仅用于科研分析，不用于医学诊断、疾病筛查或其他临床用途。</p>
              <p>本研究中的工具仅用于科研和日常心理调节探索，不用于心理疾病诊断或治疗，也不能替代心理咨询、心理治疗、医疗服务或危机干预。</p>

              <h3>研究参与流程</h3>
              <ol>
                <li>阅读本知情同意书并进行安全确认。</li>
                <li>由研究人员佩戴用于记录心电、皮电和呼吸信号的生理传感器，并检查信号质量。</li>
                <li>在正式任务开始前保持坐姿进行短时间的适应和静息记录。</li>
                <li>回忆一件近期使您反复困扰的日常负面事件。</li>
                <li>完成实验前的简短问卷。</li>
                <li>按照系统提示完成约 12 分钟的文字互动任务，期间持续记录相关生理信号。</li>
                <li>任务结束后保持坐姿进行短时间的恢复记录。</li>
                <li>完成实验后的简短问卷。</li>
                <li>在约 3 天后完成一次简短的线上随访问卷。</li>
              </ol>
              <p>部分参与者还可能在之后收到访谈邀请。是否参加访谈由您自行决定，拒绝访谈不会影响您参与本研究的其他权益。</p>
              <p>实验过程中使用的生理多导仪为非侵入式测量设备。研究人员会按照统一流程安装和取下传感器，并尽量保证测量过程的舒适与安全。</p>

              <h3>研究涉及的表达内容</h3>
              <p>实验过程中，您需要围绕一件近期的日常负面事件进行文字表达，例如学业或工作中的一般受挫、普通人际冲突、社交尴尬、一般性的失败或后悔、自我批评等反复出现的想法。</p>
              <p>本研究不要求您讨论严重创伤、暴力、虐待、重大丧失、自伤或伤害他人的想法、违法行为、当前现实危险等内容。</p>
              <p>请尽量避免在网页中输入可以直接识别您身份的信息，例如真实姓名、学校名称、电话号码、身份证号码、详细住址等。</p>

              <h3>可能的风险或不适</h3>
              <p>由于实验需要您回忆和表达近期的负面经历，过程中可能暂时出现以下情况：情绪低落、烦躁、焦虑或不适；再次想起令人困扰的经历；在持续表达或完成任务过程中感到疲惫；对部分问题或任务内容感到不愿继续回答；在完成文字互动任务时，可能出现与自身预期不一致或体验不佳的情况。</p>
              <p>此外，实验过程中需要佩戴生理多导仪传感器。电极贴或传感器与皮肤接触时，少数参与者可能出现轻微压迫感、粘贴不适、局部发红、发痒或轻微皮肤刺激。长时间保持坐姿也可能使部分参与者感到疲劳或不适。</p>
              <p>如果您已知对电极贴、粘附材料或相关材料存在明显过敏，或传感器粘贴部位存在皮肤破损、炎症等情况，请在实验开始前告知研究人员。</p>
              <p>如果您在任何时候感到不舒服，可以暂停作答、跳过不愿回答的内容、直接退出实验，或告知现场研究人员您不希望继续参加。您无需说明退出理由，退出不会影响您应有的权益。</p>
              <p>如果系统或研究人员发现您当前可能存在自伤、伤害他人、严重失控或其他现实危险，正常实验流程将被停止，网页将显示固定的安全提示和求助信息，并由现场研究人员按照预先制定的安全流程进行处理。</p>

              <h3>可能的收益</h3>
              <p>参加本研究可能为您提供一次围绕近期困扰进行结构化表达和整理的机会。部分参与者可能会在实验过程中对反复出现的负面想法产生新的观察角度，或者感到与这些想法之间形成了一定距离；也可能没有明显变化。但本研究不能保证您一定会获得情绪改善。</p>
              <p>本研究获得的数据将用于探索日常心理调节工具的设计和安全使用方式，并为相关研究提供参考。</p>
              <p>完成本研究相应环节后，您将按照研究招募说明获得相应的参与报酬。</p>

              <h3>隐私和数据保密</h3>
              <p>本研究将尽可能保护您的个人隐私，并按照研究所需的最小范围收集和使用相关数据。实验数据主要通过匿名参与者编号进行记录。研究数据库不会以您的姓名作为识别方式。用于后续随访的联系方式如需收集，将与主要研究数据分开保存，不会直接与您的实验内容放在同一数据表中。</p>
              <p>您在本研究中产生的数据仅用于本研究及与本研究直接相关的毕业论文、学术分析和研究报告。不会公开您的姓名、联系方式等直接身份信息，也不会以能够直接识别您个人身份的方式展示实验内容。</p>
              <p>研究数据的具体保存期限和删除方式将按照伦理审查批准后的数据管理方案执行。</p>

              <h3>联系方式</h3>
              <p>如果您对本研究的内容、实验流程、数据使用或参与者权益有疑问，可以联系研究者。</p>
              <p>如您在研究过程中出现明显心理不适，也可以联系学校心理咨询中心或其他专业心理健康服务机构。如存在紧急的人身安全风险，请及时联系当地紧急救助服务。</p>
            </div>

            <form class="consent-confirm" id="consent-form">
              <h3>知情同意确认</h3>
              <label class="choice">
                <input type="radio" name="consent" value="agree" required />
                <span>
                  <strong>我自愿同意参加</strong>
                  <span>我已年满 18 周岁，并已阅读和理解以上内容。</span>
                </span>
              </label>
              <label class="choice">
                <input type="radio" name="consent" value="decline" required />
                <span>
                  <strong>我不同意参加</strong>
                  <span>选择后将结束本次流程。</span>
                </span>
              </label>
              <div class="button-row">
                <button class="button button--primary" type="submit">确认选择</button>
              </div>
            </form>
          </div>
        </section>
        <aside class="side-note">
          <h3>你可以随时停下</h3>
          <p>阅读、作答和文字任务过程中都可以选择退出，无需说明原因。</p>
          <p>请勿在文本中填写真实姓名、学校、地址、电话等身份信息。</p>
        </aside>
      </div>
    `);

    document.getElementById("consent-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const selected = new FormData(event.currentTarget).get("consent");
      navigate(selected === "agree" ? "event" : "withdrawn");
    });
  }

  function renderEventRecall() {
    renderShell(`
      <div class="page-title">
        <p class="eyebrow">前测 · 事件回忆</p>
        <h2>选择一件近期反复想起的事</h2>
        <p class="lead">请花大约 2 分钟，回想近 14 天内一件让你感到困扰、并且曾在脑中反复出现的日常负面事件。</p>
      </div>
      <div class="page-grid">
        <form class="card" id="event-form">
          <div class="card__body section-stack">
            <div class="form-field">
              <label class="form-label" for="event-label">给这件事取一个简短的代称</label>
              <input
                class="text-input"
                id="event-label"
                name="event-label"
                type="text"
                minlength="2"
                maxlength="20"
                required
                autocomplete="off"
                placeholder="请勿写真实姓名或具体地点"
              />
            </div>
            <div class="form-field">
              <label class="form-label" for="event-summary">这件事发生了什么？</label>
              <textarea
                class="text-area"
                id="event-summary"
                name="event-summary"
                minlength="10"
                maxlength="500"
                required
                placeholder="请用 1 至 3 句话写下你认为必要的经过"
              ></textarea>
            </div>
            <div class="form-field">
              <label class="form-label" for="core-thought">想到这件事时，你脑中最常反复出现的一句话是什么？</label>
              <textarea
                class="text-area"
                id="core-thought"
                name="core-thought"
                maxlength="200"
                required
                placeholder="请尽量用一句话写下来"
              ></textarea>
            </div>
            <p class="error-note" id="page-error"></p>
            <div class="button-row">
              <button class="button button--primary" type="submit">进入前测问卷</button>
              <button class="button button--ghost" type="button" data-exit>暂时退出</button>
            </div>
          </div>
        </form>
        <aside class="side-note">
          <h3>事件范围</h3>
          <p>可以选择学业或工作受挫、普通人际冲突、社交尴尬、一般失败、后悔或自我批评等事件。</p>
          <p>请不要选择严重创伤、暴力、虐待、重大丧失、自伤他伤、违法行为或当前现实危险。</p>
        </aside>
      </div>
    `);

    bindExitButtons();
    document.getElementById("event-form").addEventListener("submit", (event) => {
      event.preventDefault();
      state.event = {
        label: document.getElementById("event-label").value.trim(),
        summary: document.getElementById("event-summary").value.trim(),
        coreThought: document.getElementById("core-thought").value.trim(),
      };
      navigate("bsri-pre");
    });
  }

  function rangeQuestion(name, question, minLabel, maxLabel, max = 100) {
    return `
      <div class="question-card">
        <div class="range-field">
          <div class="range-field__top">
            <label class="form-label" for="${name}">${question}</label>
            <output class="range-value" id="${name}-value" data-empty="true">待选择</output>
          </div>
          <input
            class="range-input"
            id="${name}"
            name="${name}"
            type="range"
            min="0"
            max="${max}"
            value="${Math.round(max / 2)}"
            data-touched="false"
            aria-describedby="${name}-labels"
          />
          <div class="range-labels" id="${name}-labels">
            <span>0 ${minLabel}</span>
            <span>${max} ${maxLabel}</span>
          </div>
        </div>
      </div>
    `;
  }

  function bindRanges() {
    document.querySelectorAll(".range-input").forEach((input) => {
      const output = document.getElementById(`${input.id}-value`);
      const update = () => {
        input.dataset.touched = "true";
        output.dataset.empty = "false";
        output.value = input.value;
        output.textContent = input.value;
      };
      input.addEventListener("input", update);
      input.addEventListener("change", update);
    });
  }

  function collectRanges(form) {
    const result = {};
    const ranges = [...form.querySelectorAll(".range-input")];
    const untouched = ranges.find((input) => input.dataset.touched !== "true");
    if (untouched) {
      untouched.focus();
      showError("请完成所有题目后再继续。", form.querySelector(".error-note").id);
      return null;
    }
    ranges.forEach((input) => {
      result[input.name] = Number(input.value);
    });
    return result;
  }

  function renderBsri(phase) {
    const isPre = phase === "pre";
    const title = isPre ? "实验前问卷" : "任务后的感受";
    renderShell(`
      <div class="page-title">
        <p class="eyebrow">${isPre ? "前测" : "后测"} · BSRI</p>
        <h2>${title}</h2>
        <p class="lead">请根据此时此刻的真实感受作答。每道题都需要主动点击或拖动量尺。</p>
      </div>
      <form class="card" id="bsri-form">
        <div class="card__body section-stack">
          ${bsriItems
            .map((item, index) =>
              rangeQuestion(
                `bsri-${index + 1}`,
                `${index + 1}. ${item}`,
                "完全不同意",
                "完全同意",
              ),
            )
            .join("")}
          <p class="error-note" id="bsri-error"></p>
          <div class="button-row">
            <button class="button button--primary" type="submit">继续</button>
            <button class="button button--ghost" type="button" data-exit>暂时退出</button>
          </div>
        </div>
      </form>
    `);

    bindRanges();
    bindExitButtons();
    document.getElementById("bsri-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const values = collectRanges(event.currentTarget);
      if (!values) return;
      const target = isPre ? state.pretest : state.posttest;
      target.bsri = Object.values(values);
      navigate(isPre ? "event-pre" : "event-post");
    });
  }

  function renderEventMeasures(phase) {
    const isPre = phase === "pre";
    const eventLabel = state.event.label || "你选择的事件";
    const coreThought = state.event.coreThought || "你在前测中写下的那句话";
    renderShell(`
      <div class="page-title">
        <p class="eyebrow">${isPre ? "前测" : "后测"} · 事件相关问题</p>
        <h2>此刻与这件事有关的感受</h2>
        <p class="lead">请按第一反应作答。提交后将不能返回修改。</p>
      </div>
      <div class="page-grid">
        <form class="card" id="event-measures-form">
          <div class="card__body section-stack">
            ${rangeQuestion(
              "negative-emotion",
              `此刻，当你想到“${escapeHtml(eventLabel)}”这件事时，你的负面情绪有多强烈？`,
              "完全没有",
              "极其强烈",
            )}
            ${rangeQuestion(
              "thought-belief",
              `你此前写下的想法是“${escapeHtml(coreThought)}”。此刻，你在多大程度上觉得这句话是真的？`,
              "完全不相信",
              "完全相信",
            )}
            ${rangeQuestion(
              "thought-distance",
              "此刻，你觉得自己与这条想法之间有多大的心理距离？",
              "完全陷在这条想法里",
              "能从很远的距离观察它",
            )}
            ${rangeQuestion(
              "distress",
              "此刻，这件事让你感到多困扰？",
              "完全不困扰",
              "极度困扰",
              10,
            )}
            <p class="error-note" id="event-measures-error"></p>
            <div class="button-row">
              <button class="button button--primary" type="submit">${isPre ? "开始文字任务" : "继续"}</button>
              <button class="button button--ghost" type="button" data-exit>暂时退出</button>
            </div>
          </div>
        </form>
        <aside class="side-note">
          <h3>关于作答</h3>
          <p>量尺没有默认答案。每一道题都需要你主动点击或拖动后才能提交。</p>
          <p>没有标准答案，也不需要猜测研究者希望看到怎样的变化。</p>
        </aside>
      </div>
    `);

    bindRanges();
    bindExitButtons();
    document.getElementById("event-measures-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const values = collectRanges(event.currentTarget);
      if (!values) return;
      const target = isPre ? state.pretest : state.posttest;
      target.eventMeasures = values;
      navigate(isPre ? "assigning" : "usability");
    });
  }

  function renderAssigning() {
    renderShell(`
      <section class="loading-screen" aria-live="polite">
        <div>
          <div class="loading-orbit" aria-hidden="true"></div>
          <h2>正在准备文字任务</h2>
          <p class="lead">请保持当前页面打开，这通常只需要几秒钟。</p>
          <p class="error-note" id="assign-error"></p>
          <div class="button-row" id="assign-actions" hidden>
            <button class="button button--primary" type="button" id="retry-assign">重新尝试</button>
          </div>
        </div>
      </section>
    `);
    assignCondition();
  }

  async function assignCondition() {
    try {
      let condition;
      if (isLocalPreview()) {
        const randomValue = new Uint32Array(1);
        window.crypto.getRandomValues(randomValue);
        condition = randomValue[0] % 2 === 0 ? "ai" : "writing";
        await new Promise((resolve) => window.setTimeout(resolve, 650));
      } else {
        const result = await apiRequest(config.ENDPOINTS.randomize, {
          participantId: state.participantId,
        });
        condition = result.condition;
      }

      if (!['ai', 'writing'].includes(condition)) {
        throw new Error("分组结果无效");
      }
      state.condition = condition;
      navigate(condition === "ai" ? "chat" : "writing");
    } catch (error) {
      showError("暂时无法准备任务，请检查网络后重新尝试或联系现场研究者。", "assign-error");
      const actions = document.getElementById("assign-actions");
      actions.hidden = false;
      document.getElementById("retry-assign").addEventListener("click", () => {
        actions.hidden = true;
        document.getElementById("assign-error").classList.remove("is-visible");
        assignCondition();
      });
    }
  }

  function timerMarkup() {
    return `<span class="time-pill" aria-live="polite">剩余时间 <strong id="task-timer">12:00</strong></span>`;
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function startTaskTimer() {
    clearTaskTimer();
    state.secondsRemaining = Number(config.TASK_DURATION_SECONDS) || 720;
    const timer = document.getElementById("task-timer");
    if (timer) timer.textContent = formatTime(state.secondsRemaining);

    state.timerId = window.setInterval(() => {
      state.secondsRemaining -= 1;
      const currentTimer = document.getElementById("task-timer");
      if (currentTimer) currentTimer.textContent = formatTime(Math.max(0, state.secondsRemaining));
      if (state.secondsRemaining <= 0) finishTask();
    }, 1000);
  }

  function clearTaskTimer() {
    if (state.timerId) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function renderChat() {
    renderShell(`
      <section class="workspace" aria-labelledby="chat-title">
        <header class="workspace__header">
          <div class="workspace__title">
            <p>文字任务</p>
            <h2 id="chat-title">文字对话</h2>
          </div>
          <div class="workspace__actions">
            ${timerMarkup()}
            <button class="button button--ghost" type="button" data-exit>退出</button>
          </div>
        </header>
        <div class="workspace__body chat-body" id="chat-body">
          <div class="chat-empty" id="chat-empty">
            <div>
              <div class="chat-empty__mark" aria-hidden="true"><span></span></div>
              <h3>正在连接文字对话</h3>
              <p id="chat-empty-text">第一条引导将由大模型实时生成，页面不会使用预设回复。</p>
            </div>
          </div>
          <div class="message-list" id="message-list" aria-live="polite"></div>
        </div>
        <footer class="chat-composer">
          <form id="chat-form">
            <div class="composer-box">
              <label class="sr-only" for="chat-input">输入你想说的内容</label>
              <textarea id="chat-input" rows="1" maxlength="2000" placeholder="写下你此刻愿意表达的内容" disabled></textarea>
              <button class="send-button" type="submit" aria-label="发送" disabled>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 12 20 4l-5.6 16-3.1-6.1L4 12Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <p class="composer-hint">Enter 发送，Shift + Enter 换行。请勿填写真实姓名或联系方式。</p>
            <p class="error-note" id="chat-error"></p>
          </form>
        </footer>
      </section>
      <div class="button-row">
        <button class="button button--secondary" type="button" id="finish-chat">提前完成任务</button>
      </div>
    `);

    bindExitButtons();
    bindChatEvents();
    beginAiSession();
  }

  function bindChatEvents() {
    const input = document.getElementById("chat-input");
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        document.getElementById("chat-form").requestSubmit();
      }
    });
    document.getElementById("chat-form").addEventListener("submit", sendChatMessage);
    document.getElementById("finish-chat").addEventListener("click", finishTask);
  }

  function setChatEnabled(enabled) {
    const input = document.getElementById("chat-input");
    const button = document.querySelector(".send-button");
    if (!input || !button) return;
    input.disabled = !enabled;
    button.disabled = !enabled;
    if (enabled) input.focus();
  }

  function appendMessage(role, text) {
    const empty = document.getElementById("chat-empty");
    if (empty) empty.hidden = true;

    const list = document.getElementById("message-list");
    const message = document.createElement("article");
    message.className = `message message--${role}`;
    const bubble = document.createElement("div");
    bubble.className = "message__bubble";
    bubble.textContent = text;
    const meta = document.createElement("span");
    meta.className = "message__meta";
    meta.textContent = role === "user" ? "你" : "文字助手";
    message.append(bubble, meta);
    list.append(message);
    document.getElementById("chat-body").scrollTop = document.getElementById("chat-body").scrollHeight;
  }

  function appendThinking() {
    const empty = document.getElementById("chat-empty");
    if (empty) empty.hidden = true;
    const list = document.getElementById("message-list");
    const wrapper = document.createElement("article");
    wrapper.className = "message message--assistant";
    wrapper.id = "thinking-message";
    wrapper.innerHTML = `
      <div class="message__bubble">
        <span class="thinking" aria-label="正在生成回复">
          <span></span><span></span><span></span>
        </span>
      </div>
      <span class="message__meta">正在生成回复</span>
    `;
    list.append(wrapper);
  }

  function removeThinking() {
    document.getElementById("thinking-message")?.remove();
  }

  async function beginAiSession() {
    if (isLocalPreview() && !config.API_BASE) {
      const text = document.getElementById("chat-empty-text");
      text.textContent = "前端页面已经准备好。连接后端模型接口后，第一条引导会在这里实时生成。";
      showError("当前为本地前端预览，尚未连接大模型接口。", "chat-error");
      return;
    }

    appendThinking();
    try {
      const result = await apiRequest(config.ENDPOINTS.chatStart, {
        participantId: state.participantId,
        event: state.event,
      });
      if (!result.reply || typeof result.reply !== "string") {
        throw new Error("模型回复为空");
      }
      removeThinking();
      state.messages.push({ role: "assistant", content: result.reply });
      appendMessage("assistant", result.reply);
      setChatEnabled(true);
      startTaskTimer();
    } catch (error) {
      removeThinking();
      showError("暂时无法连接文字对话，请检查网络或联系现场研究者。", "chat-error");
    }
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    const input = document.getElementById("chat-input");
    const content = input.value.trim();
    if (!content) return;

    const chatError = document.getElementById("chat-error");
    chatError.classList.remove("is-visible");
    input.value = "";
    input.style.height = "auto";
    state.messages.push({ role: "user", content });
    appendMessage("user", content);
    setChatEnabled(false);
    appendThinking();

    try {
      const result = await apiRequest(config.ENDPOINTS.chatReply, {
        participantId: state.participantId,
        event: state.event,
        messages: state.messages,
      });
      if (!result.reply || typeof result.reply !== "string") {
        throw new Error("模型回复为空");
      }
      removeThinking();
      state.messages.push({ role: "assistant", content: result.reply });
      appendMessage("assistant", result.reply);
      setChatEnabled(true);
    } catch (error) {
      removeThinking();
      showError("回复生成失败。请稍后重试，或联系现场研究者。你刚才的输入仍保留在当前页面中。", "chat-error");
      setChatEnabled(true);
    }
  }

  function renderWriting() {
    const prompts = [
      {
        title: "这件事发生了什么？",
        detail: "请写下你认为必要的经过。你可以从事情开始的地方写起，也可以直接写最让你在意的部分。",
        placeholder: "在这里记录事情的经过",
      },
      {
        title: "你最反复想到的内容是什么？",
        detail: "可以写下一句话、一个画面或某个反复出现的片段。",
        placeholder: "在这里记录反复出现的内容",
      },
      {
        title: "这件事带来了哪些感受？",
        detail: "请按你愿意的程度描述。你可以写一种感受，也可以写几种同时出现的感受。",
        placeholder: "在这里记录你的感受",
      },
      {
        title: "这件事目前怎样影响你？",
        detail: "可以写它对情绪、注意力或日常安排的影响。如果没有明显影响，也可以如实写下。",
        placeholder: "在这里记录它目前带来的影响",
      },
    ];

    renderShell(`
      <section class="workspace" aria-labelledby="writing-title">
        <header class="workspace__header">
          <div class="workspace__title">
            <p>文字任务</p>
            <h2 id="writing-title">文字记录</h2>
          </div>
          <div class="workspace__actions">
            ${timerMarkup()}
            <button class="button button--ghost" type="button" data-exit>退出</button>
          </div>
        </header>
        <div class="workspace__body writing-body">
          <p class="writing-intro">请按自己的节奏完成四段文字记录。每一部分篇幅不限，也可以返回修改。页面不会评价、解释或回应你写下的内容。</p>
          <div class="writing-grid">
            ${prompts
              .map(
                (prompt, index) => `
                  <section class="writing-card">
                    <h3>${index + 1}. ${prompt.title}</h3>
                    <p>${prompt.detail}</p>
                    <label class="sr-only" for="writing-${index + 1}">${prompt.title}</label>
                    <textarea class="text-area writing-input" id="writing-${index + 1}" maxlength="3000" placeholder="${prompt.placeholder}"></textarea>
                    <div class="save-state" id="writing-${index + 1}-status" aria-live="polite"></div>
                  </section>
                `,
              )
              .join("")}
            <section class="writing-card">
              <h3>自由补充</h3>
              <p>如果还有愿意补充的内容，可以继续写在这里。这一部分可以留空。</p>
              <label class="sr-only" for="writing-extra">自由补充</label>
              <textarea class="text-area writing-input" id="writing-extra" maxlength="3000" placeholder="选填"></textarea>
              <div class="save-state" id="writing-extra-status" aria-live="polite"></div>
            </section>
          </div>
        </div>
        <footer class="workspace__footer">
          <span class="form-hint">请勿填写真实姓名、学校、地址或联系方式。</span>
          <button class="button button--primary" type="button" id="finish-writing">完成记录</button>
        </footer>
      </section>
    `);

    bindExitButtons();
    document.querySelectorAll(".writing-input").forEach((input) => {
      let statusTimer;
      input.addEventListener("input", () => {
        window.clearTimeout(statusTimer);
        const status = document.getElementById(`${input.id}-status`);
        status.textContent = "正在暂存";
        statusTimer = window.setTimeout(() => {
          state.writing[input.id] = input.value;
          status.textContent = "已暂存于当前会话";
        }, 350);
      });
    });
    document.getElementById("finish-writing").addEventListener("click", () => {
      document.querySelectorAll(".writing-input").forEach((input) => {
        state.writing[input.id] = input.value;
      });
      finishTask();
    });
    startTaskTimer();
  }

  function finishTask() {
    clearTaskTimer();
    navigate("bsri-post");
  }

  function likertQuestion(group, index, text) {
    return `
      <div class="likert-row">
        <p class="likert-row__text">${index + 1}. ${text}</p>
        <div>
          <div class="likert-options" role="radiogroup" aria-label="${escapeHtml(text)}">
            ${Array.from({ length: 7 }, (_, value) => value + 1)
              .map(
                (value) => `
                  <label class="likert-option">
                    <input type="radio" name="${group}-${index}" value="${value}" required />
                    <span>${value}</span>
                  </label>
                `,
              )
              .join("")}
          </div>
          <div class="likert-labels"><span>非常不同意</span><span>非常同意</span></div>
        </div>
      </div>
    `;
  }

  function renderUsability() {
    const conditionItems = state.condition === "ai" ? aiExperienceItems : writingExperienceItems;
    renderShell(`
      <div class="page-title">
        <p class="eyebrow">后测 · 使用体验</p>
        <h2>刚才的页面使用感受</h2>
        <p class="lead">以下问题只了解页面和任务体验，不会影响参与报酬。</p>
      </div>
      <form class="card" id="usability-form">
        <div class="card__body">
          <section aria-labelledby="common-usability-title">
            <h3 id="common-usability-title">页面使用</h3>
            <div class="scale-block">
              ${commonUsabilityItems.map((item, index) => likertQuestion("common", index, item)).join("")}
            </div>
          </section>
          <section aria-labelledby="task-experience-title" style="margin-top: 2rem">
            <h3 id="task-experience-title">任务体验</h3>
            <div class="scale-block">
              ${conditionItems.map((item, index) => likertQuestion("condition", index, item)).join("")}
            </div>
          </section>
          <section aria-labelledby="safety-title" style="margin-top: 2rem">
            <h3 id="safety-title">当前状态</h3>
            <div class="section-stack" style="margin-top: 1rem">
              <div class="question-card">
                <p class="form-label">与任务开始前相比，这次任务是否让你的困扰明显加重？</p>
                <div class="button-row">
                  ${["没有", "有一点", "明显加重", "非常明显地加重"]
                    .map(
                      (label) => `
                        <label class="choice" style="flex: 1 1 150px">
                          <input type="radio" name="distress-change" value="${label}" required />
                          <span><strong>${label}</strong></span>
                        </label>
                      `,
                    )
                    .join("")}
                </div>
              </div>
              <div class="question-card">
                <p class="form-label">任务过程中，你是否有过想停止，却感到自己不能停止的情况？</p>
                <div class="button-row">
                  ${["没有", "有"]
                    .map(
                      (label) => `
                        <label class="choice" style="flex: 1 1 160px">
                          <input type="radio" name="felt-unable-to-stop" value="${label}" required />
                          <span><strong>${label}</strong></span>
                        </label>
                      `,
                    )
                    .join("")}
                </div>
              </div>
              <div class="question-card">
                <p class="form-label">此刻，你是否觉得自己的状态稳定，可以结束本次实验？</p>
                <div class="button-row">
                  ${["是", "否", "不确定"]
                    .map(
                      (label) => `
                        <label class="choice" style="flex: 1 1 130px">
                          <input type="radio" name="stable" value="${label}" required />
                          <span><strong>${label}</strong></span>
                        </label>
                      `,
                    )
                    .join("")}
                </div>
              </div>
              <div class="question-card">
                <p class="form-label">此刻，你是否希望与现场研究者单独沟通？</p>
                <div class="button-row">
                  ${["希望", "暂时不需要"]
                    .map(
                      (label) => `
                        <label class="choice" style="flex: 1 1 160px">
                          <input type="radio" name="contact-researcher" value="${label}" required />
                          <span><strong>${label}</strong></span>
                        </label>
                      `,
                    )
                    .join("")}
                </div>
              </div>
              <div class="form-field">
                <label class="form-label" for="open-feedback">刚才的任务中，哪一个部分对你最有帮助、最不舒服或最难使用？</label>
                <textarea class="text-area" id="open-feedback" maxlength="1000" placeholder="选填，请勿填写可以识别你身份的信息"></textarea>
              </div>
            </div>
          </section>
          <p class="error-note" id="usability-error"></p>
          <div class="button-row">
            <button class="button button--primary" type="submit">提交并结束</button>
          </div>
        </div>
      </form>
    `);

    document.getElementById("usability-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      state.posttest.usability = Object.fromEntries(formData.entries());
      state.posttest.openFeedback = document.getElementById("open-feedback").value.trim();
      const stable = formData.get("stable");
      const contact = formData.get("contact-researcher");
      navigate(stable === "是" && contact === "暂时不需要" ? "complete" : "support");
    });
  }

  function renderComplete() {
    renderShell(`
      <section class="completion">
        <div class="completion-card">
          <div class="completion-mark" aria-hidden="true"></div>
          <p class="eyebrow">本次实验已完成</p>
          <h2>感谢你的参与</h2>
          <p>你的回答将以参与者编号保存。为避免影响后续随访，本页暂不说明不同文字任务对应的具体研究假设。</p>
          <div class="completion-card__divider"></div>
          <h3>离开前</h3>
          <p>刚才的回忆和书写可能让某些感受暂时变得更明显。你可以先停留一会儿，喝水，看看周围的环境，等状态稳定后再离开。</p>
          <p>研究者将在约三天后按知情同意书中的方式邀请你完成简短随访问卷。</p>
          <div class="button-row" style="justify-content: center">
            <button class="button button--primary" type="button" id="confirm-finish">确认结束</button>
            <button class="button button--secondary" type="button" id="contact-researcher">我想联系现场研究者</button>
          </div>
        </div>
      </section>
    `);

    document.getElementById("confirm-finish").addEventListener("click", () => {
      submitCompletion("complete");
      document.getElementById("confirm-finish").disabled = true;
      document.getElementById("confirm-finish").textContent = "已完成";
    });
    document.getElementById("contact-researcher").addEventListener("click", () => navigate("support"));
  }

  function renderSupport() {
    renderShell(`
      <section class="completion">
        <div class="completion-card">
          <p class="eyebrow">实验已暂停</p>
          <h2>请先与现场研究者联系</h2>
          <p>你不需要继续回答问题，也不需要向网页说明更多细节。请留在当前页面，并告知现场研究者。</p>
          <p>现场研究者会按照已经审核的流程与你确认当前情况，并一起决定接下来是否需要其他支持。</p>
          <div class="completion-card__divider"></div>
          <p>暂停或退出不会影响你已经享有的参与者权利，报酬安排以知情同意书为准。</p>
          <div class="button-row" style="justify-content: center">
            <button class="button button--primary" type="button" id="notify-researcher">通知现场研究者</button>
          </div>
        </div>
      </section>
    `);
    document.getElementById("notify-researcher").addEventListener("click", () => {
      submitCompletion("support_requested");
      document.getElementById("notify-researcher").disabled = true;
      document.getElementById("notify-researcher").textContent = "已记录请求";
    });
  }

  function renderWithdrawn() {
    renderShell(`
      <section class="completion">
        <div class="completion-card">
          <p class="eyebrow">流程已结束</p>
          <h2>你的选择已确认</h2>
          <p>你没有参加本次研究。无需进行后续操作。</p>
          <div class="completion-card__divider"></div>
          <p>如果你是在实验过程中退出，请联系现场研究者了解后续安排。</p>
        </div>
      </section>
    `);
  }

  function submitCompletion(status) {
    if (isLocalPreview() && !config.API_BASE) return;
    apiRequest(config.ENDPOINTS.complete, {
      participantId: state.participantId,
      status,
      condition: state.condition,
      event: state.event,
      pretest: state.pretest,
      posttest: state.posttest,
      writing: state.condition === "writing" ? state.writing : undefined,
    }).catch(() => {
      // 完整的保存失败处理应由后端接入时统一实现。
    });
  }

  function bindExitButtons() {
    document.querySelectorAll("[data-exit]").forEach((button) => {
      button.addEventListener("click", () => exitDialog.showModal());
    });
  }

  function bindDialog() {
    exitDialog.querySelector("[data-dialog-close]").addEventListener("click", () => exitDialog.close());
    exitDialog.querySelector("[data-confirm-exit]").addEventListener("click", () => {
      exitDialog.close();
      submitCompletion("withdrawn");
      navigate("withdrawn");
    });
    exitDialog.addEventListener("click", (event) => {
      if (event.target === exitDialog) exitDialog.close();
    });
  }

  function applyPreviewRoute() {
    const preview = new URLSearchParams(window.location.search).get("preview");
    const routes = {
      home: "home",
      consent: "consent",
      event: "event",
      pretest: "bsri-pre",
      chat: "chat",
      writing: "writing",
      posttest: "bsri-post",
      usability: "usability",
      complete: "complete",
      support: "support",
    };
    if (!preview || !routes[preview]) return false;
    state.previewMode = true;
    if (preview === "chat") state.condition = "ai";
    if (preview === "writing") state.condition = "writing";
    if (preview === "usability" && !state.condition) state.condition = "ai";
    state.currentScreen = routes[preview];
    return true;
  }

  function renderCurrentScreen() {
    switch (state.currentScreen) {
      case "home":
        renderHome();
        break;
      case "consent":
        renderConsent();
        break;
      case "event":
        renderEventRecall();
        break;
      case "bsri-pre":
        renderBsri("pre");
        break;
      case "event-pre":
        renderEventMeasures("pre");
        break;
      case "assigning":
        renderAssigning();
        break;
      case "chat":
        renderChat();
        break;
      case "writing":
        renderWriting();
        break;
      case "bsri-post":
        renderBsri("post");
        break;
      case "event-post":
        renderEventMeasures("post");
        break;
      case "usability":
        renderUsability();
        break;
      case "complete":
        renderComplete();
        break;
      case "support":
        renderSupport();
        break;
      case "withdrawn":
        renderWithdrawn();
        break;
      default:
        renderHome();
    }
  }

  bindDialog();
  applyPreviewRoute();
  renderCurrentScreen();
})();
