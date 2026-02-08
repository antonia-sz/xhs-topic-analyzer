// ============================================================
// 全局变量与配置
// ============================================================

const MAX_STAGING_COUNT = 100; // 暂存区上限

// 存储提取的原始内容（用于发送API）
let extractedData = {
  title: '',
  desc: '',
  url: ''
};

// 当前分析结果的原始 Markdown
let currentAnalysisMarkdown = '';

// 当前查看的暂存详情记录 ID
let currentDetailId = null;

// API 配置（从 config.js 读取）
const API_URL = CONFIG.API_URL;
const API_KEY = CONFIG.API_KEY;

// ============================================================
// DOM 元素 - 分析页
// ============================================================
const mainView = document.getElementById('mainView');
const extractBtn = document.getElementById('extractBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const reanalyzeBtn = document.getElementById('reanalyzeBtn');
const tipMessage = document.getElementById('tipMessage');
const extractedContent = document.getElementById('extractedContent');
const thinkingStatus = document.getElementById('thinkingStatus');
const analysisResult = document.getElementById('analysisResult');
const statusIndicator = document.getElementById('statusIndicator');
const statusTitle = document.getElementById('statusTitle');
const statusDesc = document.getElementById('statusDesc');
const resultSection = document.getElementById('resultSection');
const resultHeader = document.getElementById('resultHeader');
const addToStagingBtn = document.getElementById('addToStagingBtn');
const goStagingBtn = document.getElementById('goStagingBtn');
const stagingBadge = document.getElementById('stagingBadge');

// ============================================================
// DOM 元素 - 暂存区列表页
// ============================================================
const stagingView = document.getElementById('stagingView');
const backToMainBtn = document.getElementById('backToMainBtn');
const stagingCount = document.getElementById('stagingCount');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const exportSelectedBtn = document.getElementById('exportSelectedBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const stagingList = document.getElementById('stagingList');

// ============================================================
// DOM 元素 - 暂存详情页
// ============================================================
const detailView = document.getElementById('detailView');
const backToStagingBtn = document.getElementById('backToStagingBtn');
const detailTitle = document.getElementById('detailTitle');
const detailTime = document.getElementById('detailTime');
const detailUrl = document.getElementById('detailUrl');
const detailCheckbox = document.getElementById('detailCheckbox');
const detailContent = document.getElementById('detailContent');
const deleteRecordBtn = document.getElementById('deleteRecordBtn');

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  checkPageStatus();
  updateStagingBadge();
});

// ============================================================
// 视图切换
// ============================================================
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}

// 导航事件
goStagingBtn.addEventListener('click', () => {
  switchView('stagingView');
  renderStagingList();
});

backToMainBtn.addEventListener('click', () => {
  switchView('mainView');
});

backToStagingBtn.addEventListener('click', () => {
  switchView('stagingView');
  renderStagingList();
});

// ============================================================
// 检查页面状态
// ============================================================
async function checkPageStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return !!document.getElementById('detail-title');
      }
    });

    const hasDetailTitle = results[0]?.result;

    if (!hasDetailTitle) {
      extractBtn.disabled = true;
      reanalyzeBtn.disabled = true;
      tipMessage.textContent = '请打开一篇笔记';
      tipMessage.classList.add('show');
    } else {
      extractBtn.disabled = false;
      reanalyzeBtn.disabled = false;
      tipMessage.classList.remove('show');
    }
  } catch (error) {
    console.error('检查页面状态失败:', error);
    extractBtn.disabled = true;
    reanalyzeBtn.disabled = true;
    tipMessage.textContent = '请打开一篇笔记';
    tipMessage.classList.add('show');
  }
}

// ============================================================
// 工具函数
// ============================================================
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '……';
}

function updateStatus(element, status, text) {
  const icon = element.querySelector('.status-icon');
  const textEl = element.querySelector('.status-text');
  icon.className = 'status-icon status-' + status;
  textEl.textContent = text;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(isoString) {
  const d = new Date(isoString);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateCompact(isoString) {
  const d = new Date(isoString);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

// Toast 提示
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// 确认对话框
function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <p>${escapeHtml(message)}</p>
        <div class="confirm-dialog-actions">
          <button class="btn btn-confirm-cancel">取消</button>
          <button class="btn btn-confirm-ok">确认</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.btn-confirm-cancel').addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });
    overlay.querySelector('.btn-confirm-ok').addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });
  });
}

// ============================================================
// chrome.storage.local 操作
// ============================================================
async function getStagingRecords() {
  const result = await chrome.storage.local.get('stagingRecords');
  return result.stagingRecords || [];
}

async function saveStagingRecords(records) {
  await chrome.storage.local.set({ stagingRecords: records });
}

async function addStagingRecord(record) {
  const records = await getStagingRecords();
  if (records.length >= MAX_STAGING_COUNT) {
    showToast(`暂存区已满（上限 ${MAX_STAGING_COUNT} 条），请清理后再添加`, 'error');
    return false;
  }
  records.unshift(record); // 新记录在前面
  await saveStagingRecords(records);
  return true;
}

async function deleteStagingRecord(id) {
  const records = await getStagingRecords();
  const filtered = records.filter(r => r.id !== id);
  await saveStagingRecords(filtered);
}

async function updateRecordChecked(id, checked) {
  const records = await getStagingRecords();
  const record = records.find(r => r.id === id);
  if (record) {
    record.checked = checked;
    await saveStagingRecords(records);
  }
}

async function updateAllRecordsChecked(checked) {
  const records = await getStagingRecords();
  records.forEach(r => r.checked = checked);
  await saveStagingRecords(records);
}

// ============================================================
// 更新暂存区角标
// ============================================================
async function updateStagingBadge() {
  const records = await getStagingRecords();
  const count = records.length;
  if (count > 0) {
    stagingBadge.textContent = count;
    stagingBadge.classList.remove('hidden');
  } else {
    stagingBadge.classList.add('hidden');
  }
}

// ============================================================
// 解析 AI 分析结果的 Markdown 为结构化数据
// ============================================================
function parseAnalysisMarkdown(markdown) {
  const result = {
    summary: '',
    keywords: '',
    contentType: '',
    targetAudience: '',
    coreNeeds: '',
    highlights: '',
    weaknesses: '',
    extendedTopics: '',
    riskWarnings: ''
  };

  if (!markdown) return result;

  // 按一级标题分割
  const sections = markdown.split(/^# /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const heading = lines[0].trim().toLowerCase();
    const body = lines.slice(1).join('\n').trim();

    if (heading.includes('笔记内容') || heading.includes('1.') || heading.includes('1、')) {
      // 提取一句话概括和关键词
      const bodyLines = body.split('\n').filter(l => l.trim());
      for (const line of bodyLines) {
        const trimmed = line.replace(/^[-*]\s*/, '').trim();
        if (trimmed.includes('关键词')) {
          result.keywords = trimmed.replace(/.*关键词[：:]\s*/, '').trim();
        } else if (!result.summary && trimmed.length > 0) {
          // 第一个非关键词行就是概括
          result.summary = trimmed.replace(/.*概括[：:]\s*/, '')
            .replace(/^用一句话概括主题[：:]\s*/, '')
            .replace(/^主题概括[：:]\s*/, '')
            .trim();
        }
      }
    } else if (heading.includes('选题定位') || heading.includes('2.') || heading.includes('2、')) {
      const bodyLines = body.split('\n').filter(l => l.trim());
      for (const line of bodyLines) {
        const trimmed = line.replace(/^[-*]\s*/, '').trim();
        if (trimmed.includes('内容类型')) {
          result.contentType = trimmed.replace(/.*内容类型[：:]\s*/, '').trim();
        } else if (trimmed.includes('目标人群')) {
          result.targetAudience = trimmed.replace(/.*目标人群[：:]\s*/, '').trim();
        } else if (trimmed.includes('核心需求')) {
          result.coreNeeds = trimmed.replace(/.*核心需求[：:]\s*/, '').trim();
        }
      }
      // 如果核心需求是多行的，继续收集
      if (result.coreNeeds) {
        const needsStart = body.indexOf('核心需求');
        if (needsStart !== -1) {
          const afterNeeds = body.substring(needsStart);
          const needLines = afterNeeds.split('\n').filter(l => l.trim());
          const needs = [];
          let started = false;
          for (const line of needLines) {
            const trimmed = line.replace(/^[-*]\s*/, '').trim();
            if (trimmed.includes('核心需求')) {
              started = true;
              const inline = trimmed.replace(/.*核心需求[：:]\s*/, '').trim();
              if (inline) needs.push(inline);
            } else if (started && /^[-*\d]/.test(line.trim())) {
              needs.push(trimmed);
            } else if (started) {
              break;
            }
          }
          if (needs.length > 0) result.coreNeeds = needs.join('；');
        }
      }
    } else if (heading.includes('亮点') || heading.includes('3.') || heading.includes('3、')) {
      // 分割亮点和短板
      const parts = body.split(/^## /m);
      for (const part of parts) {
        const partLines = part.trim().split('\n');
        const partHeading = partLines[0].trim().toLowerCase();
        const partBody = partLines.slice(1).join('\n').trim();
        const items = partBody.split('\n')
          .filter(l => l.trim().startsWith('-') || l.trim().startsWith('*') || /^\d+\./.test(l.trim()))
          .map(l => l.replace(/^[-*\d.]\s*/, '').trim())
          .filter(Boolean);

        if (partHeading.includes('亮点')) {
          result.highlights = items.join('；');
        } else if (partHeading.includes('短板') || partHeading.includes('不足')) {
          result.weaknesses = items.join('；');
        }
      }
      // 如果没有二级标题，尝试从body中直接提取
      if (!result.highlights && !result.weaknesses) {
        const allItems = body.split('\n')
          .filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'))
          .map(l => l.replace(/^[-*]\s*/, '').trim())
          .filter(Boolean);
        result.highlights = allItems.join('；');
      }
    } else if (heading.includes('延展') || heading.includes('4.') || heading.includes('4、')) {
      const items = body.split('\n')
        .filter(l => l.trim().startsWith('-') || l.trim().startsWith('*') || /^\d+\./.test(l.trim()))
        .map(l => l.replace(/^[-*\d.]\s*/, '').trim())
        .filter(Boolean);
      result.extendedTopics = items.join('；');
    } else if (heading.includes('风险') || heading.includes('5.') || heading.includes('5、')) {
      const items = body.split('\n')
        .filter(l => l.trim().startsWith('-') || l.trim().startsWith('*') || /^\d+\./.test(l.trim()))
        .map(l => l.replace(/^[-*\d.]\s*/, '').trim())
        .filter(Boolean);
      result.riskWarnings = items.join('；');
    }
  }

  return result;
}

// ============================================================
// 提取主题
// ============================================================
async function extractContent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const titleEl = document.getElementById('detail-title');
        const descEl = document.getElementById('detail-desc');
        return {
          title: titleEl ? titleEl.innerText.trim() : '',
          desc: descEl ? descEl.innerText.trim() : ''
        };
      }
    });

    const data = results[0]?.result;

    if (data) {
      extractedData.title = data.title;
      extractedData.desc = data.desc;
      extractedData.url = tab.url || '';

      updateStatus(statusTitle, data.title ? 'done' : 'pending', data.title ? '已提取标题' : '未找到标题');
      updateStatus(statusDesc, data.desc ? 'done' : 'pending', data.desc ? '已提取正文' : '未找到正文');

      const displayTitle = truncateText(data.title, 25);
      const displayDesc = truncateText(data.desc, 100);

      extractedContent.innerHTML = `
        <div class="title-section">
          <div class="label">标题</div>
          <div class="content">${escapeHtml(displayTitle)}</div>
        </div>
        <div class="desc-section">
          <div class="label">正文</div>
          <div class="content">${escapeHtml(displayDesc)}</div>
        </div>
      `;
      extractedContent.classList.add('show');
      analyzeBtn.disabled = false;

      // 清除之前的分析结果
      analysisResult.classList.remove('show');
      analysisResult.innerHTML = '';
      resultSection.classList.remove('show');
      resultHeader.classList.remove('show');
      addToStagingBtn.classList.add('hidden');
      addToStagingBtn.classList.remove('added');
      addToStagingBtn.textContent = '';
      currentAnalysisMarkdown = '';
    }

    return data;
  } catch (error) {
    console.error('提取内容失败:', error);
    tipMessage.textContent = '提取失败，请重试';
    tipMessage.classList.add('show');
    return null;
  }
}

// 提取按钮事件
extractBtn.addEventListener('click', extractContent);

// 重新分析按钮事件
reanalyzeBtn.addEventListener('click', async () => {
  const data = await extractContent();
  if (data && (data.title || data.desc)) {
    analyzeBtn.click();
  }
});

// ============================================================
// 分析选题
// ============================================================
analyzeBtn.addEventListener('click', async () => {
  if (!extractedData.title && !extractedData.desc) {
    return;
  }

  if (!API_KEY) {
    analysisResult.innerHTML = '<p style="color: #f44336;">API Key 未配置</p>';
    analysisResult.classList.add('show');
    return;
  }

  // 禁用按钮，显示思考状态
  analyzeBtn.disabled = true;
  reanalyzeBtn.disabled = true;
  addToStagingBtn.classList.add('hidden');
  addToStagingBtn.classList.remove('added');
  thinkingStatus.classList.add('show');
  analysisResult.classList.remove('show');

  try {
    const systemPrompt = `你将收到一条小红书笔记的标题与描述文本。请完成"选题分析"，并严格按下面 Markdown 模板输出。

【输出要求（必须按顺序）】
# 1. 笔记内容
- 用一句话概括主题，不超过30字
- 关键词：给出 3 个

# 2. 选题定位判断
- 内容类型：从「教程/经验/避坑/清单/测评对比/故事/观点/种草」中选择1-2个
- 目标人群：具体到"身份+场景+痛点"
- 核心需求：用户想解决什么问题（列 2-3 条）

# 3. 亮点与短板
## 选题亮点
- 最多写3条，每条用"证据句"说明：引用标题/描述中的关键信息点来支撑
## 选题短板
- 最多写3条，明确指出缺了什么（例如：缺结论/缺步骤/缺对比维度/缺数据/缺场景）

# 4. 可延展选题
- 最多写4条，与原主题同赛道，可参考方向：进阶/对比/避坑/清单/案例/工具模板

# 5. 选题风险提醒
- 如果涉及医疗、金融、夸大效果、敏感内容，指出风险点与安全表述建议`;

    const userContent = `【输入文本】
- 标题：${extractedData.title}
- 描述：${extractedData.desc}`;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let sseBuffer = ''; // 缓冲跨 chunk 的不完整行

    thinkingStatus.classList.remove('show');
    resultSection.classList.add('show');
    resultHeader.classList.add('show');
    analysisResult.classList.add('show');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 将新数据追加到缓冲区
      sseBuffer += decoder.decode(value, { stream: true });

      // 按换行符分割，最后一段可能不完整需要保留
      const parts = sseBuffer.split('\n');
      sseBuffer = parts.pop() || ''; // 保留最后一段不完整的数据

      for (const line of parts) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              analysisResult.innerHTML = marked.parse(fullContent);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    // 处理缓冲区中可能残留的最后一行
    if (sseBuffer.trim().startsWith('data: ') && sseBuffer.trim() !== 'data: [DONE]') {
      try {
        const json = JSON.parse(sseBuffer.trim().slice(6));
        const content = json.choices?.[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          analysisResult.innerHTML = marked.parse(fullContent);
        }
      } catch (e) {
        // 忽略
      }
    }

    if (!fullContent) {
      analysisResult.innerHTML = '<p>未获取到分析结果</p>';
    } else {
      // 保存分析结果，显示加入暂存区按钮
      currentAnalysisMarkdown = fullContent;
      addToStagingBtn.classList.remove('hidden');
      addToStagingBtn.innerHTML = `
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
          <path d="m3.3 7 8.7 5 8.7-5"></path>
          <path d="M12 22V12"></path>
        </svg>
        加入暂存区
      `;
    }

  } catch (error) {
    console.error('API 请求失败:', error);
    resultSection.classList.add('show');
    analysisResult.innerHTML = `<p style="color: #f44336;">分析失败: ${escapeHtml(error.message)}</p>`;
    analysisResult.classList.add('show');
  } finally {
    thinkingStatus.classList.remove('show');
    analyzeBtn.disabled = false;
    reanalyzeBtn.disabled = false;
  }
});

// ============================================================
// 加入暂存区
// ============================================================
addToStagingBtn.addEventListener('click', async () => {
  if (!currentAnalysisMarkdown || addToStagingBtn.classList.contains('added')) {
    return;
  }

  const parsed = parseAnalysisMarkdown(currentAnalysisMarkdown);

  const record = {
    id: Date.now().toString(),
    title: extractedData.title || '未知标题',
    url: extractedData.url || '',
    summary: parsed.summary || '暂无概括',
    analysisTime: new Date().toISOString(),
    rawMarkdown: currentAnalysisMarkdown,
    keywords: parsed.keywords,
    contentType: parsed.contentType,
    targetAudience: parsed.targetAudience,
    coreNeeds: parsed.coreNeeds,
    highlights: parsed.highlights,
    weaknesses: parsed.weaknesses,
    extendedTopics: parsed.extendedTopics,
    riskWarnings: parsed.riskWarnings,
    checked: true // 默认勾选
  };

  const success = await addStagingRecord(record);
  if (success) {
    addToStagingBtn.classList.add('added');
    addToStagingBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      已加入暂存区
    `;
    await updateStagingBadge();
    showToast('已加入暂存区');
  }
});

// ============================================================
// 暂存区列表渲染
// ============================================================
async function renderStagingList() {
  const records = await getStagingRecords();
  stagingCount.textContent = `共 ${records.length} 条记录（上限 ${MAX_STAGING_COUNT} 条）`;

  if (records.length === 0) {
    stagingList.innerHTML = `
      <div class="staging-empty">
        <svg class="staging-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
          <path d="m3.3 7 8.7 5 8.7-5"></path>
          <path d="M12 22V12"></path>
        </svg>
        <p>暂存区为空</p>
        <p class="staging-empty-hint">分析笔记后点击「加入暂存区」添加记录</p>
      </div>
    `;
    selectAllCheckbox.checked = false;
    exportSelectedBtn.disabled = true;
    deleteSelectedBtn.disabled = true;
    return;
  }

  // 渲染列表
  stagingList.innerHTML = records.map(record => `
    <div class="staging-card" data-id="${record.id}">
      <label class="checkbox-wrapper">
        <input type="checkbox" class="staging-checkbox" data-id="${record.id}" ${record.checked ? 'checked' : ''}>
      </label>
      <div class="staging-card-body" data-id="${record.id}">
        <div class="staging-card-title">${escapeHtml(truncateText(record.title, 30))}</div>
        <div class="staging-card-summary">${escapeHtml(truncateText(record.summary, 80))}</div>
        <div class="staging-card-meta">
          <span>${formatTime(record.analysisTime)}</span>
          ${record.url ? `<a class="staging-card-link" href="${escapeHtml(record.url)}" target="_blank">原文</a>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  // 更新全选状态
  const allChecked = records.every(r => r.checked);
  const someChecked = records.some(r => r.checked);
  selectAllCheckbox.checked = allChecked;
  selectAllCheckbox.indeterminate = someChecked && !allChecked;
  updateExportBtnState(records);

  // 绑定卡片点击事件（查看详情），排除 checkbox 和链接的点击
  stagingList.querySelectorAll('.staging-card-body').forEach(body => {
    body.addEventListener('click', (e) => {
      // 如果点击的是链接，不触发详情
      if (e.target.closest('.staging-card-link')) return;
      const id = body.dataset.id;
      openDetail(id);
    });
  });

  // checkbox 的 label 点击阻止冒泡（通过 JS 而非内联 onclick）
  stagingList.querySelectorAll('.checkbox-wrapper').forEach(wrapper => {
    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  // 绑定 checkbox 事件
  stagingList.querySelectorAll('.staging-checkbox').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      e.stopPropagation();
      await updateRecordChecked(cb.dataset.id, cb.checked);
      const updatedRecords = await getStagingRecords();
      const allChecked = updatedRecords.every(r => r.checked);
      const someChecked = updatedRecords.some(r => r.checked);
      selectAllCheckbox.checked = allChecked;
      selectAllCheckbox.indeterminate = someChecked && !allChecked;
      updateExportBtnState(updatedRecords);
    });
  });

  // 原文链接阻止冒泡
  stagingList.querySelectorAll('.staging-card-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });
}

function updateExportBtnState(records) {
  const checkedCount = records.filter(r => r.checked).length;
  const hasChecked = checkedCount > 0;
  exportSelectedBtn.disabled = !hasChecked;
  deleteSelectedBtn.disabled = !hasChecked;

  // 更新 tooltip 显示数量
  exportSelectedBtn.title = hasChecked ? `导出Excel (${checkedCount})` : '导出Excel';
  deleteSelectedBtn.title = hasChecked ? `删除 (${checkedCount})` : '删除';
}

// 全选/取消全选
selectAllCheckbox.addEventListener('change', async () => {
  await updateAllRecordsChecked(selectAllCheckbox.checked);
  renderStagingList();
});

// ============================================================
// 删除所选记录
// ============================================================
deleteSelectedBtn.addEventListener('click', async () => {
  const records = await getStagingRecords();
  const checkedCount = records.filter(r => r.checked).length;

  if (checkedCount === 0) {
    showToast('请先勾选要删除的记录', 'error');
    return;
  }

  const message = checkedCount === records.length
    ? `确认删除全部 ${checkedCount} 条记录？此操作不可撤销。`
    : `确认删除所选的 ${checkedCount} 条记录？此操作不可撤销。`;

  const confirmed = await showConfirm(message);
  if (confirmed) {
    const remaining = records.filter(r => !r.checked);
    await saveStagingRecords(remaining);
    renderStagingList();
    await updateStagingBadge();
    showToast(`已删除 ${checkedCount} 条记录`, 'info');
  }
});

// ============================================================
// 暂存详情页
// ============================================================
async function openDetail(id) {
  const records = await getStagingRecords();
  const record = records.find(r => r.id === id);
  if (!record) return;

  currentDetailId = id;
  detailTitle.textContent = truncateText(record.title, 20);
  detailTime.textContent = formatTime(record.analysisTime);
  detailUrl.href = record.url || '#';
  detailUrl.textContent = record.url ? '查看原文' : '无链接';
  detailCheckbox.checked = record.checked;
  detailContent.innerHTML = marked.parse(record.rawMarkdown || '暂无分析内容');

  switchView('detailView');
}

// 详情页 checkbox
detailCheckbox.addEventListener('change', async () => {
  if (currentDetailId) {
    await updateRecordChecked(currentDetailId, detailCheckbox.checked);
  }
});

// 删除记录
deleteRecordBtn.addEventListener('click', async () => {
  const confirmed = await showConfirm('确认删除此条记录？');
  if (confirmed) {
    await deleteStagingRecord(currentDetailId);
    await updateStagingBadge();
    showToast('记录已删除', 'info');
    switchView('stagingView');
    renderStagingList();
  }
});

// ============================================================
// 导出 Excel
// ============================================================
exportSelectedBtn.addEventListener('click', async () => {
  const records = await getStagingRecords();
  const selected = records.filter(r => r.checked);

  if (selected.length === 0) {
    showToast('请先勾选要导出的记录', 'error');
    return;
  }

  try {
    // 构建表头
    const headers = [
      '标题', '链接', '分析时间', '一句话概括', '关键词',
      '内容类型', '目标人群',
      '选题亮点', '选题短板', '可延展选题', '选题风险提醒'
    ];

    // 构建数据行
    const rows = selected.map(record => [
      record.title || '',
      record.url || '',
      formatTime(record.analysisTime),
      record.summary || '',
      record.keywords || '',
      record.contentType || '',
      record.targetAudience || '',
      record.highlights || '',
      record.weaknesses || '',
      record.extendedTopics || '',
      record.riskWarnings || ''
    ]);

    // 合并表头和数据
    const data = [headers, ...rows];

    // 使用 SheetJS 创建工作簿
    const ws = XLSX.utils.aoa_to_sheet(data);

    // 设置列宽
    ws['!cols'] = [
      { wch: 30 },  // 标题
      { wch: 40 },  // 链接
      { wch: 18 },  // 分析时间
      { wch: 35 },  // 一句话概括
      { wch: 20 },  // 关键词
      { wch: 15 },  // 内容类型
      { wch: 25 },  // 目标人群
      { wch: 40 },  // 选题亮点
      { wch: 40 },  // 选题短板
      { wch: 40 },  // 可延展选题
      { wch: 35 }   // 选题风险提醒
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '选题分析');

    // 生成文件名
    const dateStr = formatDateCompact(new Date().toISOString());
    const titlePart = selected.length === 1
      ? truncateText(selected[0].title, 20).replace(/[\\/:*?"<>|]/g, '')
      : `${selected.length}篇笔记`;
    const fileName = `选题分析_${dateStr}_${titlePart}.xlsx`;

    // 生成 Blob 并下载
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    // 使用 chrome.downloads API 下载
    chrome.downloads.download({
      url: url,
      filename: fileName,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('下载失败:', chrome.runtime.lastError);
        // 降级方案：使用 <a> 标签
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      // 延迟释放 URL
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });

    showToast(`已导出 ${selected.length} 条记录`);
  } catch (error) {
    console.error('导出失败:', error);
    showToast('导出失败: ' + error.message, 'error');
  }
});
