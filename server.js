const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const ONLINE_FILE = path.join(DATA_DIR, 'online.json');

// 默认配置
const DEFAULT_CONFIG = {
  families: [
    { id: 'tiger', name: '猛虎队', emoji: '🐯', members: [
      { id: 'tiger1', name: '大虎', startWeight: 85.0 },
      { id: 'tiger2', name: '小虎', startWeight: 72.0 }
    ]},
    { id: 'eagle', name: '飞鹰队', emoji: '🦅', members: [
      { id: 'eagle1', name: '大鹰', startWeight: 90.0 },
      { id: 'eagle2', name: '小鹰', startWeight: 68.0 }
    ]},
    { id: 'panda', name: '熊猫队', emoji: '🐼', members: [
      { id: 'panda1', name: '大熊猫', startWeight: 78.0 },
      { id: 'panda2', name: '小熊猫', startWeight: 65.0 }
    ]}
  ],
  projectStart: '2026-08-01',
  projectEnd: '2026-10-31'
};

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 初始化数据文件
function initData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  if (!fs.existsSync(RECORDS_FILE)) fs.writeFileSync(RECORDS_FILE, JSON.stringify([], null, 2));
}
initData();

function readJSON(filepath) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf-8')); }
  catch { return filepath === RECORDS_FILE ? [] : DEFAULT_CONFIG; }
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ==================== API 路由 ====================

// 获取配置（团队、成员信息）
app.get('/api/config', (req, res) => {
  res.json(readJSON(CONFIG_FILE));
});

// 更新配置（支持修改队名、成员名、emoji、起始体重）
app.put('/api/config', (req, res) => {
  const config = req.body;
  writeJSON(CONFIG_FILE, config);
  res.json({ ok: true });
});

// 获取所有体重记录
app.get('/api/records', (req, res) => {
  const records = readJSON(RECORDS_FILE);
  res.json(records);
});

// 添加体重记录
app.post('/api/records', (req, res) => {
  const { person_id, person_name, family_id, family_name, weight, date } = req.body;
  if (!person_id || !weight || !date) {
    return res.status(400).json({ error: '缺少必填字段: person_id, weight, date' });
  }

  const records = readJSON(RECORDS_FILE);
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    person_id,
    person_name: person_name || person_id,
    family_id: family_id || '',
    family_name: family_name || '',
    weight: parseFloat(weight),
    date,
    created_at: new Date().toISOString()
  };
  records.push(record);
  writeJSON(RECORDS_FILE, records);
  res.json(record);
});

// 删除记录
app.delete('/api/records/:id', (req, res) => {
  const records = readJSON(RECORDS_FILE);
  const idx = records.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '记录不存在' });
  records.splice(idx, 1);
  writeJSON(RECORDS_FILE, records);
  res.json({ ok: true });
});

// 在线状态上报 & 获取
app.post('/api/online', (req, res) => {
  const { person_id, person_name } = req.body;
  if (!person_id) return res.status(400).json({ error: '缺少 person_id' });

  let online = {};
  try { online = JSON.parse(fs.readFileSync(ONLINE_FILE, 'utf-8')); } catch {}

  // 清理超过30秒未上报的
  const now = Date.now();
  Object.keys(online).forEach(k => {
    if (now - online[k].ts > 30000) delete online[k];
  });

  online[person_id] = { person_name: person_name || person_id, ts: now };
  fs.writeFileSync(ONLINE_FILE, JSON.stringify(online));

  res.json({ online: Object.values(online).map(v => v.person_name), count: Object.keys(online).length });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 所有其他路由返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🏆 瘦者为王看板已启动: http://localhost:${PORT}`);
});
