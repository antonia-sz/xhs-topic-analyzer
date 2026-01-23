// 存储提取的原始内容（用于发送API）
let extractedData = {
  title: '',
  desc: ''
};

// API 配置（从 config.js 读取）
const API_URL = CONFIG.API_URL;
const API_KEY = CONFIG.API_KEY;

// DOM 元素
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
const resultSection = document.querySelector('.result-section');
const resultHeader = document.getElementById('resultHeader');

// 初始化：检查页面状态
document.addEventListener('DOMContentLoaded', () => {
  checkPageStatus();
});

// 检查当前页面是否包含 detail-title 元素
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

// 截断文本
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '……';
}

// 更新状态指示器
function updateStatus(element, status, text) {
  const icon = element.querySelector('.status-icon');
  const textEl = element.querySelector('.status-text');
  icon.className = 'status-icon status-' + status;
  textEl.textContent = text;
}

// 提取主题按钮点击事件
extractBtn.addEventListener('click', async () => {
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
      // 存储原始数据
      extractedData.title = data.title;
      extractedData.desc = data.desc;
      
      // 更新状态指示器
      updateStatus(statusTitle, data.title ? 'done' : 'pending', data.title ? '已提取标题' : '未找到标题');
      updateStatus(statusDesc, data.desc ? 'done' : 'pending', data.desc ? '已提取正文' : '未找到正文');
      
      // 显示截断后的内容
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
      
      // 启用分析按钮
      analyzeBtn.disabled = false;
      
      // 清除之前的分析结果
      analysisResult.classList.remove('show');
      analysisResult.innerHTML = '';
      resultSection.classList.remove('show');
      resultHeader.classList.remove('show');
    }
  } catch (error) {
    console.error('提取内容失败:', error);
    tipMessage.textContent = '提取失败，请重试';
    tipMessage.classList.add('show');
  }
});

// 重新分析按钮点击事件
reanalyzeBtn.addEventListener('click', async () => {
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
      // 存储原始数据
      extractedData.title = data.title;
      extractedData.desc = data.desc;
      
      // 更新状态指示器
      updateStatus(statusTitle, data.title ? 'done' : 'pending', data.title ? '已提取标题' : '未找到标题');
      updateStatus(statusDesc, data.desc ? 'done' : 'pending', data.desc ? '已提取正文' : '未找到正文');
      
      // 显示截断后的内容
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
      
      // 启用分析按钮
      analyzeBtn.disabled = false;
      
      // 清除之前的分析结果
      analysisResult.classList.remove('show');
      analysisResult.innerHTML = '';
      resultSection.classList.remove('show');
      resultHeader.classList.remove('show');
    }
    
    if (data && (data.title || data.desc)) {
      analyzeBtn.click();
    }
  } catch (error) {
    console.error('重新分析失败:', error);
    tipMessage.textContent = '重新分析失败，请重试';
    tipMessage.classList.add('show');
  }
});

// HTML 转义，防止 XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 分析选题按钮点击事件
analyzeBtn.addEventListener('click', async () => {
  if (!extractedData.title && !extractedData.desc) {
    return;
  }
  
  // 检查 API Key
  if (!API_KEY) {
    analysisResult.innerHTML = '<p style="color: #f44336;">API Key 未配置</p>';
    analysisResult.classList.add('show');
    return;
  }
  
  // 禁用按钮，显示思考状态
  analyzeBtn.disabled = true;
  reanalyzeBtn.disabled = true;
  thinkingStatus.classList.add('show');
  analysisResult.classList.remove('show');
  
  try {
    // 构建请求内容
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
    
    // 流式读取响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    
    // 隐藏思考状态，显示结果区域
    thinkingStatus.classList.remove('show');
    resultSection.classList.add('show');
    resultHeader.classList.add('show');
    analysisResult.classList.add('show');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const json = JSON.parse(line.slice(6));
            const content = json.choices?.[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              // 实时更新显示
              analysisResult.innerHTML = marked.parse(fullContent);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
    
    if (!fullContent) {
      analysisResult.innerHTML = '<p>未获取到分析结果</p>';
    }
    
  } catch (error) {
    console.error('API 请求失败:', error);
    resultSection.classList.add('show');
    analysisResult.innerHTML = `<p style="color: #f44336;">分析失败: ${escapeHtml(error.message)}</p>`;
    analysisResult.classList.add('show');
  } finally {
    // 启用按钮
    thinkingStatus.classList.remove('show');
    analyzeBtn.disabled = false;
    reanalyzeBtn.disabled = false;
  }
});
