import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
  { auth: { persistSession: false } }
);

const JWT_SECRET = process.env.JWT_SECRET || 'edumanager_dev_secret_change_me';
const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Format d\'image non supporté'), ok);
  }
});

/* ---------------- HELPERS ---------------- */
const ah = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

function auth(roles = []) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentification requise' });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const { data: user } = await supabase.from('users')
        .select('id, username, full_name, role, active')
        .eq('id', payload.id).single();
      if (!user || !user.active) return res.status(401).json({ error: 'Compte inactif' });
      if (roles.length && !roles.includes(user.role)) return res.status(403).json({ error: 'Accès refusé' });
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: 'Session expirée' });
    }
  };
}

const adminOnly = auth(['admin']);
const canWrite = auth(['admin', 'secretaire']);

/* Classes visibles pour un enseignant (affecté via teacher_subjects ou titulaire) */
const TEACHER_ROLE = 'professeur';
async function visibleClassIds(user) {
  if (user.role === 'admin' || user.role === 'secretaire') return null;
  const [ts, tch] = await Promise.all([
    supabase.from('teacher_subjects').select('class_id').eq('teacher_user_id', user.id),
    supabase.from('classes').select('id').eq('teacher_user_id', user.id)
  ]);
  const ids = new Set();
  for (const r of ts.data || []) ids.add(r.class_id);
  for (const r of tch.data || []) ids.add(r.id);
  return [...ids];
}

/* Vérifie qu'un enseignant a accès à la classe (ou null pour admin) */
async function assertClassAccess(user, classId) {
  const ids = await visibleClassIds(user);
  if (ids === null) return true;
  return ids.includes(Number(classId));
}

async function activeYearId() {
  const { data } = await supabase.from('academic_years')
    .select('id').eq('is_active', true).order('id', { ascending: false }).limit(1).maybeSingle();
  return data ? data.id : null;
}

async function nextNumber(prefix, counterName) {
  const year = new Date().getFullYear();
  const { data: seq } = await supabase.rpc('next_counter', { counter_name: counterName });
  return `${prefix}-${year}-${String(seq || 1).padStart(4, '0')}`;
}

async function paymentStats(enrollmentId) {
  const { data: paidRows } = await supabase.from('tuition_payments')
    .select('amount').eq('enrollment_id', enrollmentId);
  const paid = (paidRows || []).reduce((s, r) => s + r.amount, 0);
  const { data: enr } = await supabase.from('enrollments')
    .select('class_id').eq('id', enrollmentId).maybeSingle();
  let tuition = 0;
  if (enr) {
    const { data: cls } = await supabase.from('classes')
      .select('tuition_fee').eq('id', enr.class_id).maybeSingle();
    tuition = cls?.tuition_fee || 0;
  }
  return { paid, tuition, balance: tuition - paid };
}

function schoolPublic(s) {
  let logo_url = null;
  if (s && s.logo_path) {
    const { data } = supabase.storage.from('logos').getPublicUrl(path.basename(s.logo_path));
    logo_url = data?.publicUrl || null;
  }
  return { ...s, logo_url };
}

/* ---------------- AUTH ---------------- */
app.post('/api/auth/login', ah(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Identifiants requis' });
  const { data: user } = await supabase.from('users')
    .select('*').eq('username', username).maybeSingle();
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  if (!user.active) return res.status(401).json({ error: 'Compte désactivé' });
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
}));

app.get('/api/auth/me', auth(), (req, res) => res.json({ user: req.user }));

/* ---------------- SCHOOL / SETTINGS ---------------- */
app.get('/api/school', ah(async (req, res) => {
  const { data: s } = await supabase.from('school').select('*').eq('id', 1).maybeSingle();
  res.json(schoolPublic(s));
}));

app.put('/api/school', adminOnly, ah(async (req, res) => {
  const fields = ['name', 'type', 'address', 'phone', 'email', 'currency', 'motto'];
  const body = {};
  for (const f of fields) {
    if (req.body && req.body[f] !== undefined) body[f] = req.body[f];
  }
  if (Object.keys(body).length) {
    await supabase.from('school').update(body).eq('id', 1);
  }
  const { data: s } = await supabase.from('school').select('*').eq('id', 1).maybeSingle();
  res.json(schoolPublic(s));
}));

app.post('/api/school/logo', adminOnly, upload.single('logo'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
  const filename = `logo_${Date.now()}${ext}`;
  const { error: upErr } = await supabase.storage.from('logos')
    .upload(filename, req.file.buffer, { upsert: true, contentType: req.file.mimetype });
  if (upErr) return res.status(500).json({ error: upErr.message });
  await supabase.from('school').update({ logo_path: filename }).eq('id', 1);
  const { data: s } = await supabase.from('school').select('*').eq('id', 1).maybeSingle();
  res.json(schoolPublic(s));
}));

/* ---------------- USERS ---------------- */
app.get('/api/users', auth(['admin', 'secretaire']), ah(async (req, res) => {
  const { data } = await supabase.from('users')
    .select('id, username, full_name, role, active, created_at').order('full_name');
  res.json(data || []);
}));

app.post('/api/users', adminOnly, ah(async (req, res) => {
  const { username, password, full_name, role } = req.body || {};
  if (!username || !password || !full_name || !role) return res.status(400).json({ error: 'Champs requis' });
  if (!['admin', 'secretaire', 'professeur'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  const { data: existing } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
  if (existing) return res.status(409).json({ error: 'Nom d\'utilisateur déjà pris' });
  const { data, error } = await supabase.from('users')
    .insert({ username, password_hash: bcrypt.hashSync(password, 10), full_name, role })
    .select('id, username, full_name, role, active').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

app.put('/api/users/:id', adminOnly, ah(async (req, res) => {
  const { data: u } = await supabase.from('users').select('*').eq('id', req.params.id).maybeSingle();
  if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const body = {};
  const { full_name, role, password, active } = req.body || {};
  if (full_name !== undefined) body.full_name = full_name;
  if (role !== undefined) body.role = role;
  if (password) body.password_hash = bcrypt.hashSync(password, 10);
  if (active !== undefined) body.active = !!active;
  if (Object.keys(body).length) await supabase.from('users').update(body).eq('id', u.id);
  res.json({ ok: true });
}));

/* ---------------- ACADEMIC YEARS ---------------- */
app.get('/api/academic-years', auth(), ah(async (req, res) => {
  const { data } = await supabase.from('academic_years').select('*').order('id', { ascending: false });
  res.json(data || []);
}));

app.post('/api/academic-years', adminOnly, ah(async (req, res) => {
  const { label, set_active } = req.body || {};
  if (!label) return res.status(400).json({ error: 'Libellé requis' });
  if (set_active) await supabase.from('academic_years').update({ is_active: false }).neq('id', 0);
  const { data, error } = await supabase.from('academic_years')
    .insert({ label, is_active: !!set_active }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

app.put('/api/academic-years/:id', adminOnly, ah(async (req, res) => {
  const { set_active } = req.body || {};
  if (set_active) {
    await supabase.from('academic_years').update({ is_active: false }).neq('id', 0);
    await supabase.from('academic_years').update({ is_active: true }).eq('id', req.params.id);
  }
  res.json({ ok: true });
}));

/* ---------------- LEVELS ---------------- */
app.get('/api/levels', auth(), ah(async (req, res) => {
  const { data } = await supabase.from('levels').select('*').order('sort_order').order('id');
  res.json(data || []);
}));

app.post('/api/levels', adminOnly, ah(async (req, res) => {
  const { name, sort_order = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const { data, error } = await supabase.from('levels')
    .insert({ name, sort_order }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

app.put('/api/levels/:id', adminOnly, ah(async (req, res) => {
  const body = {};
  if (req.body?.name !== undefined) body.name = req.body.name;
  if (req.body?.sort_order !== undefined) body.sort_order = req.body.sort_order;
  if (Object.keys(body).length) await supabase.from('levels').update(body).eq('id', req.params.id);
  res.json({ ok: true });
}));

app.delete('/api/levels/:id', adminOnly, ah(async (req, res) => {
  const { data: cls } = await supabase.from('classes')
    .select('id').eq('level_id', req.params.id).limit(1);
  if (cls && cls.length) {
    return res.status(409).json({ error: 'Ce niveau contient des classes. Vous pouvez le renommer à la place.', linked: true });
  }
  await supabase.from('levels').delete().eq('id', req.params.id);
  res.json({ ok: true });
}));

/* ---------------- SUBJECTS ---------------- */
app.get('/api/subjects', auth(), ah(async (req, res) => {
  const { data } = await supabase.from('subjects').select('*').order('name');
  res.json(data || []);
}));

app.post('/api/subjects', adminOnly, ah(async (req, res) => {
  const { name, coefficient = 1 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const { data, error } = await supabase.from('subjects')
    .insert({ name, coefficient }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

app.put('/api/subjects/:id', adminOnly, ah(async (req, res) => {
  const body = {};
  if (req.body?.name !== undefined) body.name = req.body.name;
  if (req.body?.coefficient !== undefined) body.coefficient = req.body.coefficient;
  if (Object.keys(body).length) await supabase.from('subjects').update(body).eq('id', req.params.id);
  res.json({ ok: true });
}));

app.delete('/api/subjects/:id', adminOnly, ah(async (req, res) => {
  const [cs, gr, ts] = await Promise.all([
    supabase.from('class_subjects').select('id').eq('subject_id', req.params.id).limit(1),
    supabase.from('grades').select('id').eq('subject_id', req.params.id).limit(1),
    supabase.from('teacher_subjects').select('id').eq('subject_id', req.params.id).limit(1)
  ]);
  if ((cs.data && cs.data.length) || (gr.data && gr.data.length) || (ts.data && ts.data.length)) {
    return res.status(409).json({ error: 'Cette matière est utilisée par des classes, notes ou enseignants. Vous pouvez la renommer ou modifier son coefficient.', linked: true });
  }
  await supabase.from('subjects').delete().eq('id', req.params.id);
  res.json({ ok: true });
}));

/* ---------------- CLASSES ---------------- */
app.get('/api/classes', auth(), ah(async (req, res) => {
  const yearId = Number(req.query.year_id) || await activeYearId();
  const includeArchived = req.query.include_archived === '1';
  const visible = await visibleClassIds(req.user);
  let q = supabase.from('classes').select('*').eq('academic_year_id', yearId);
  if (!includeArchived) q = q.eq('archived', false);
  if (visible !== null) q = q.in('id', visible);
  const { data: classes } = await q;
  const rows = classes || [];
  const levelIds = [...new Set(rows.map(c => c.level_id))];
  const teacherIds = [...new Set(rows.map(c => c.teacher_user_id).filter(Boolean))];
  const cycleIds = [...new Set(rows.map(c => c.cycle_id).filter(Boolean))];
  const classIds = rows.map(c => c.id);

  const [levels, teachers, cycles, counts] = await Promise.all([
    levelIds.length ? supabase.from('levels').select('id, name').in('id', levelIds) : { data: [] },
    teacherIds.length ? supabase.from('users').select('id, full_name').in('id', teacherIds) : { data: [] },
    cycleIds.length ? supabase.from('cycles').select('id, name').in('id', cycleIds) : { data: [] },
    classIds.length ? supabase.from('enrollments').select('class_id').in('class_id', classIds).eq('academic_year_id', yearId).eq('status', 'actif') : { data: [] }
  ]);

  const levelMap = Object.fromEntries((levels.data || []).map(l => [l.id, l.name]));
  const teacherMap = Object.fromEntries((teachers.data || []).map(t => [t.id, t.full_name]));
  const cycleMap = Object.fromEntries((cycles.data || []).map(c => [c.id, c.name]));
  const countMap = {};
  for (const e of counts.data || []) countMap[e.class_id] = (countMap[e.class_id] || 0) + 1;

  res.json(rows.map(c => ({
    ...c,
    level_name: levelMap[c.level_id] || '—',
    cycle_name: c.cycle_id ? cycleMap[c.cycle_id] : null,
    teacher_name: c.teacher_user_id ? teacherMap[c.teacher_user_id] : null,
    student_count: countMap[c.id] || 0
  })));
}));

app.post('/api/classes', adminOnly, ah(async (req, res) => {
  const { level_id, name, tuition_fee = 0, teacher_user_id = null, academic_year_id } = req.body || {};
  if (!level_id || !name) return res.status(400).json({ error: 'Niveau et nom requis' });
  const yearId = academic_year_id || await activeYearId();
  const { data, error } = await supabase.from('classes')
    .insert({ level_id, academic_year_id: yearId, name, tuition_fee, teacher_user_id }).select('id').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

app.put('/api/classes/:id', adminOnly, ah(async (req, res) => {
  const body = {};
  if (req.body?.level_id !== undefined) body.level_id = req.body.level_id;
  if (req.body?.name !== undefined) body.name = req.body.name;
  if (req.body?.tuition_fee !== undefined) body.tuition_fee = req.body.tuition_fee;
  if (req.body?.teacher_user_id !== undefined) body.teacher_user_id = req.body.teacher_user_id || null;
  if (req.body?.cycle_id !== undefined) body.cycle_id = req.body.cycle_id || null;
  if (Object.keys(body).length) await supabase.from('classes').update(body).eq('id', req.params.id);
  res.json({ ok: true });
}));

app.delete('/api/classes/:id', adminOnly, ah(async (req, res) => {
  const { data: enr } = await supabase.from('enrollments')
    .select('id').eq('class_id', req.params.id).limit(1);
  const { data: ev } = await supabase.from('evaluations')
    .select('id').eq('class_id', req.params.id).limit(1);
  if ((enr && enr.length) || (ev && ev.length)) {
    return res.status(409).json({ error: 'Cette classe contient des élèves ou des évaluations. Archivez-la à la place.', linked: true });
  }
  await supabase.from('classes').delete().eq('id', req.params.id);
  res.json({ ok: true });
}));

app.post('/api/classes/:id/archive', adminOnly, ah(async (req, res) => {
  const archived = req.body?.archived !== undefined ? !!req.body.archived : true;
  await supabase.from('classes').update({ archived }).eq('id', req.params.id);
  if (archived) {
    await supabase.from('enrollments')
      .update({ status: 'inactif' }).eq('class_id', req.params.id).eq('status', 'actif');
  }
  res.json({ ok: true });
}));

app.get('/api/classes/:id/subjects', auth(), ah(async (req, res) => {
  const { data } = await supabase.from('class_subjects')
    .select('id, subject_id, coefficient, subjects(name, coefficient)')
    .eq('class_id', req.params.id);
  res.json((data || []).map(r => ({
    id: r.subject_id, name: r.subjects?.name,
    coefficient: r.coefficient != null ? r.coefficient : r.subjects?.coefficient,
    link_id: r.id
  })).sort((a, b) => a.name.localeCompare(b.name)));
}));

app.post('/api/classes/:id/subjects', adminOnly, ah(async (req, res) => {
  const { subject_ids } = req.body || {};
  if (!Array.isArray(subject_ids)) return res.status(400).json({ error: 'subject_ids requis' });
  await supabase.from('class_subjects').delete().eq('class_id', req.params.id);
  if (subject_ids.length) {
    const coeffs = req.body.coefficients || {};
    await supabase.from('class_subjects')
      .insert(subject_ids.map(subject_id => ({
        class_id: req.params.id, subject_id,
        coefficient: coeffs[subject_id] != null ? Number(coeffs[subject_id]) : null
      })));
  }
  res.json({ ok: true });
}));

/* ---------------- PERIODS ---------------- */
app.get('/api/periods', auth(), ah(async (req, res) => {
  const yearId = Number(req.query.year_id) || await activeYearId();
  const { data } = await supabase.from('periods')
    .select('*').eq('academic_year_id', yearId).order('sort_order');
  res.json(data || []);
}));

app.post('/api/periods', adminOnly, ah(async (req, res) => {
  const { name, sort_order = 0, academic_year_id, group_name = '' } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const yearId = academic_year_id || await activeYearId();
  const { data, error } = await supabase.from('periods')
    .insert({ academic_year_id: yearId, name, sort_order, group_name }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

app.put('/api/periods/:id', adminOnly, ah(async (req, res) => {
  const body = {};
  if (req.body?.name !== undefined) body.name = req.body.name;
  if (req.body?.sort_order !== undefined) body.sort_order = req.body.sort_order;
  if (req.body?.group_name !== undefined) body.group_name = req.body.group_name;
  if (req.body?.locked !== undefined) body.locked = !!req.body.locked;
  if (Object.keys(body).length) await supabase.from('periods').update(body).eq('id', req.params.id);
  res.json({ ok: true });
}));

app.delete('/api/periods/:id', adminOnly, ah(async (req, res) => {
  const [gr, ev] = await Promise.all([
    supabase.from('grades').select('id').eq('period_id', req.params.id).limit(1),
    supabase.from('evaluations').select('id').eq('period_id', req.params.id).limit(1)
  ]);
  if ((gr.data && gr.data.length) || (ev.data && ev.data.length)) {
    return res.status(409).json({ error: 'Cette période contient des notes ou évaluations. Vous pouvez la renommer à la place.', linked: true });
  }
  await supabase.from('periods').delete().eq('id', req.params.id);
  res.json({ ok: true });
}));

/* ---------------- STUDENTS ---------------- */
app.get('/api/students', auth(), ah(async (req, res) => {
  const { q = '', class_id, year_id, include_archived } = req.query;
  const yearId = Number(year_id) || await activeYearId();

  const { data: allStudents } = await supabase.from('students').select('*').order('last_name').order('first_name');
  let students = allStudents || [];
  if (!include_archived) students = students.filter(s => !s.archived);
  if (q) {
    const needle = q.toLowerCase();
    students = students.filter(s =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(needle) ||
      (s.parent_name || '').toLowerCase().includes(needle));
  }

  const studentIds = students.map(s => s.id);
  let enrQuery = supabase.from('enrollments')
    .select('id, student_id, class_id, status, enrollment_date, is_reenrollment, classes(name, tuition_fee, level_id), levels(name)')
    .eq('academic_year_id', yearId);
  if (class_id) enrQuery = enrQuery.eq('class_id', class_id);
  if (studentIds.length) enrQuery = enrQuery.in('student_id', studentIds);
  const { data: enrollments } = await enrQuery;

  const enrMap = {};
  for (const e of enrollments || []) enrMap[e.student_id] = e;

  const enrollmentIds = (enrollments || []).map(e => e.id);
  let payMap = {};
  if (enrollmentIds.length) {
    const { data: pays } = await supabase.from('tuition_payments')
      .select('enrollment_id, amount').in('enrollment_id', enrollmentIds);
    for (const p of pays || []) payMap[p.enrollment_id] = (payMap[p.enrollment_id] || 0) + p.amount;
  }

  res.json(students.map(s => {
    const e = enrMap[s.id];
    return {
      ...s,
      enrollment_id: e?.id || null,
      class_id: e?.class_id || null,
      enrollment_status: e?.status || null,
      enrollment_date: e?.enrollment_date || null,
      is_reenrollment: e?.is_reenrollment ? 1 : 0,
      class_name: e?.classes?.name || null,
      tuition_fee: e?.classes?.tuition_fee || 0,
      level_name: e?.levels?.name || null,
      paid: payMap[e?.id] || 0
    };
  }));
}));

app.post('/api/students', canWrite, ah(async (req, res) => {
  const b = req.body || {};
  if (!b.first_name || !b.last_name) return res.status(400).json({ error: 'Nom et prénom requis' });
  const { class_id, is_reenrollment = 0, academic_year_id, ...info } = b;
  const { data, error } = await supabase.from('students')
    .insert({
      first_name: b.first_name, last_name: b.last_name, gender: b.gender || 'M',
      birth_date: b.birth_date || '', birth_place: b.birth_place || '',
      parent_name: b.parent_name || '', parent_phone: b.parent_phone || '',
      parent_email: b.parent_email || '', address: b.address || ''
    }).select('id').single();
  if (error) return res.status(500).json({ error: error.message });
  const studentId = data.id;
  if (class_id) {
    const yearId = Number(academic_year_id) || await activeYearId();
    const { data: enr, error: enrErr } = await supabase.from('enrollments')
      .insert({ student_id: studentId, class_id, academic_year_id: yearId, is_reenrollment: !!is_reenrollment })
      .select('id').single();
    if (enrErr) return res.status(500).json({ error: enrErr.message });
    res.json({ id: studentId, enrollment_id: enr.id });
  } else {
    res.json({ id: studentId });
  }
}));

app.put('/api/students/:id', canWrite, ah(async (req, res) => {
  const fields = ['first_name', 'last_name', 'gender', 'birth_date', 'birth_place', 'parent_name', 'parent_phone', 'parent_email', 'address'];
  const body = {};
  for (const f of fields) {
    if (req.body && req.body[f] !== undefined) body[f] = req.body[f];
  }
  if (Object.keys(body).length) await supabase.from('students').update(body).eq('id', req.params.id);
  res.json({ ok: true });
}));

app.delete('/api/students/:id', adminOnly, ah(async (req, res) => {
  const { data: enr } = await supabase.from('enrollments')
    .select('id').eq('student_id', req.params.id).limit(1);
  if (enr && enr.length) {
    return res.status(409).json({ error: 'Cet élève a des données liées (inscriptions, paiements). Archivez-le à la place.', linked: true });
  }
  await supabase.from('students').delete().eq('id', req.params.id);
  res.json({ ok: true });
}));

app.post('/api/students/:id/archive', adminOnly, ah(async (req, res) => {
  const archived = req.body?.archived !== undefined ? !!req.body.archived : true;
  await supabase.from('students').update({ archived }).eq('id', req.params.id);
  if (archived) {
    await supabase.from('enrollments')
      .update({ status: 'inactif' }).eq('student_id', req.params.id).eq('status', 'actif');
  }
  res.json({ ok: true });
}));

app.post('/api/students/:id/enroll', canWrite, ah(async (req, res) => {
  const { class_id, is_reenrollment = 0, academic_year_id } = req.body || {};
  if (!class_id) return res.status(400).json({ error: 'Classe requise' });
  const yearId = Number(academic_year_id) || await activeYearId();
  const { data: existing } = await supabase.from('enrollments')
    .select('id').eq('student_id', req.params.id).eq('academic_year_id', yearId).maybeSingle();
  if (existing) {
    await supabase.from('enrollments')
      .update({ class_id, is_reenrollment: !!is_reenrollment, status: 'actif' }).eq('id', existing.id);
    return res.json({ enrollment_id: existing.id });
  }
  const { data, error } = await supabase.from('enrollments')
    .insert({ student_id: req.params.id, class_id, academic_year_id: yearId, is_reenrollment: !!is_reenrollment })
    .select('id').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ enrollment_id: data.id });
}));

app.put('/api/enrollments/:id/status', canWrite, ah(async (req, res) => {
  const { status } = req.body || {};
  if (!['actif', 'inactif'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  await supabase.from('enrollments').update({ status }).eq('id', req.params.id);
  res.json({ ok: true });
}));

/* ---------------- TUITION PAYMENTS ---------------- */
app.get('/api/payments', auth(), ah(async (req, res) => {
  const { q = '', class_id, from, to, method } = req.query;
  let query = supabase.from('tuition_payments')
    .select('id, amount, payment_date, method, receipt_number, note, category, created_at, recorded_by, enrollment_id')
    .order('payment_date', { ascending: false }).limit(500);
  if (class_id) {
    const { data: enr } = await supabase.from('enrollments').select('id').eq('class_id', class_id);
    const ids = (enr || []).map(e => e.id);
    if (ids.length) query = query.in('enrollment_id', ids); else return res.json([]);
  }
  if (from) query = query.gte('payment_date', from);
  if (to) query = query.lte('payment_date', to);
  if (method) query = query.eq('method', method);
  let { data: payments } = await query;
  payments = payments || [];

  const enrollmentIds = [...new Set(payments.map(p => p.enrollment_id))];
  let enrInfo = {};
  if (enrollmentIds.length) {
    const { data: enrRows } = await supabase.from('enrollments')
      .select('id, students(first_name, last_name), classes(name)')
      .in('id', enrollmentIds);
    for (const e of enrRows || []) {
      enrInfo[e.id] = { first_name: e.students?.first_name, last_name: e.students?.last_name, class_name: e.classes?.name };
    }
  }
  const recorderIds = [...new Set(payments.map(p => p.recorded_by).filter(Boolean))];
  let recMap = {};
  if (recorderIds.length) {
    const { data: recRows } = await supabase.from('users').select('id, full_name').in('id', recorderIds);
    for (const u of recRows || []) recMap[u.id] = u.full_name;
  }

  if (q) {
    const needle = q.toLowerCase();
    payments = payments.filter(p =>
      (enrInfo[p.enrollment_id]?.first_name || '').toLowerCase().includes(needle) ||
      (enrInfo[p.enrollment_id]?.last_name || '').toLowerCase().includes(needle) ||
      (p.receipt_number || '').toLowerCase().includes(needle));
  }

  res.json(payments.map(p => ({
    ...p,
    first_name: enrInfo[p.enrollment_id]?.first_name,
    last_name: enrInfo[p.enrollment_id]?.last_name,
    class_name: enrInfo[p.enrollment_id]?.class_name,
    recorder_name: recMap[p.recorded_by]
  })));
}));

app.post('/api/payments', canWrite, ah(async (req, res) => {
  const { enrollment_id, amount, payment_date, note = '', category = 'scolarite' } = req.body || {};
  if (!enrollment_id || !amount || amount <= 0) return res.status(400).json({ error: 'Montant et élève requis' });
  const { data: enrollment } = await supabase.from('enrollments').select('id').eq('id', enrollment_id).maybeSingle();
  if (!enrollment) return res.status(404).json({ error: 'Inscription introuvable' });
  const receipt = await nextNumber('REC', 'receipt');
  const { data, error } = await supabase.from('tuition_payments')
    .insert({
      enrollment_id, amount,
      payment_date: payment_date || new Date().toISOString().slice(0, 10),
      method: 'especes', receipt_number: receipt, note, category, recorded_by: req.user.id
    }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  const stats = await paymentStats(enrollment_id);
  const { data: pay } = await supabase.from('tuition_payments')
    .select('*, enrollments(students(first_name, last_name), classes(name)), users(full_name)')
    .eq('id', data.id).single();
  res.json({
    payment: {
      ...pay,
      first_name: pay.enrollments?.students?.first_name,
      last_name: pay.enrollments?.students?.last_name,
      class_name: pay.enrollments?.classes?.name,
      recorder_name: pay.users?.full_name
    },
    stats
  });
}));

/* ---------------- TRANSACTIONS (entrées/sorties) ---------------- */
app.get('/api/transactions', auth(), ah(async (req, res) => {
  const { type, from, to, q = '' } = req.query;
  let query = supabase.from('transactions')
    .select('*').order('transaction_date', { ascending: false }).limit(500);
  if (type) query = query.eq('type', type);
  if (from) query = query.gte('transaction_date', from);
  if (to) query = query.lte('transaction_date', to);
  let { data } = await query;
  data = data || [];
  const recorderIds = [...new Set(data.map(t => t.recorded_by).filter(Boolean))];
  let recMap = {};
  if (recorderIds.length) {
    const { data: rows } = await supabase.from('users').select('id, full_name').in('id', recorderIds);
    for (const u of rows || []) recMap[u.id] = u.full_name;
  }
  if (q) {
    const needle = q.toLowerCase();
    data = data.filter(t =>
      (t.label || '').toLowerCase().includes(needle) ||
      (t.invoice_number || '').toLowerCase().includes(needle) ||
      (t.category || '').toLowerCase().includes(needle));
  }
  res.json(data.map(t => ({ ...t, recorder_name: recMap[t.recorded_by] })));
}));

app.post('/api/transactions', canWrite, ah(async (req, res) => {
  const { type, category = '', label, amount, transaction_date, description = '' } = req.body || {};
  if (!['entree', 'sortie'].includes(type)) return res.status(400).json({ error: 'Type invalide' });
  if (!label || !amount || amount <= 0) return res.status(400).json({ error: 'Libellé et montant requis' });
  const invoice = await nextNumber(type === 'entree' ? 'ENT' : 'SOR', type === 'entree' ? 'entree' : 'sortie');
  const { data, error } = await supabase.from('transactions')
    .insert({
      type, category, label, amount,
      transaction_date: transaction_date || new Date().toISOString().slice(0, 10),
      invoice_number: invoice, description, recorded_by: req.user.id
    }).select('*, users(full_name)').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ transaction: { ...data, recorder_name: data.users?.full_name } });
}));

/* ---------------- DASHBOARD ---------------- */
app.get('/api/dashboard', auth(), ah(async (req, res) => {
  const yearId = await activeYearId();
  const today = new Date().toISOString().slice(0, 10);
  const year = String(new Date().getFullYear());

  const { data: activeYear } = await supabase.from('academic_years').select('*').eq('id', yearId).maybeSingle();

  const { data: enrIds } = await supabase.from('enrollments').select('id').eq('academic_year_id', yearId);
  const enrIdsArr = (enrIds || []).map(e => e.id);

  let tuitionPaidYear = 0;
  if (enrIdsArr.length) {
    const { data: pays } = await supabase.from('tuition_payments').select('amount').in('enrollment_id', enrIdsArr);
    tuitionPaidYear = (pays || []).reduce((s, p) => s + p.amount, 0);
  }

  const { data: todayPays } = await supabase.from('tuition_payments').select('amount').eq('payment_date', today);
  const tuitionPaidToday = (todayPays || []).reduce((s, p) => s + p.amount, 0);

  const { data: enrClasses } = await supabase.from('enrollments')
    .select('classes(tuition_fee)').eq('academic_year_id', yearId).eq('status', 'actif');
  const tuitionExpected = (enrClasses || []).reduce((s, e) => s + (e.classes?.tuition_fee || 0), 0);

  const sumTx = async (type, from, to) => {
    let q = supabase.from('transactions').select('amount').eq('type', type);
    if (from) q = q.gte('transaction_date', from);
    if (to) q = q.lte('transaction_date', to);
    const { data } = await q;
    return (data || []).reduce((s, t) => s + t.amount, 0);
  };
  const entriesYear = await sumTx('entree', `${year}-01-01`, `${year}-12-31`);
  const entriesToday = await sumTx('entree', today, today);
  const expensesYear = await sumTx('sortie', `${year}-01-01`, `${year}-12-31`);
  const expensesToday = await sumTx('sortie', today, today);

  const { count: studentCount } = await supabase.from('enrollments')
    .select('*', { count: 'exact', head: true }).eq('academic_year_id', yearId).eq('status', 'actif');
  const { count: classCount } = await supabase.from('classes')
    .select('*', { count: 'exact', head: true }).eq('academic_year_id', yearId);

  const { data: recentPayments } = await supabase.from('tuition_payments')
    .select('id, amount, payment_date, method, receipt_number, enrollment_id, enrollments(students(first_name, last_name), classes(name, tuition_fee))')
    .order('payment_date', { ascending: false }).limit(8);

  const recentEnrIds = [...new Set((recentPayments || []).map(p => p.enrollment_id))];
  let payTotals = {};
  if (recentEnrIds.length) {
    const { data: pays } = await supabase.from('tuition_payments').select('enrollment_id, amount').in('enrollment_id', recentEnrIds);
    for (const p of pays || []) payTotals[p.enrollment_id] = (payTotals[p.enrollment_id] || 0) + p.amount;
  }

  const { data: recentTx } = await supabase.from('transactions')
    .select('*').order('transaction_date', { ascending: false }).limit(6);

  const { data: yearPays } = await supabase.from('tuition_payments')
    .select('payment_date, amount').gte('payment_date', `${year}-01-01`).lte('payment_date', `${year}-12-31`);
  const monthMap = {};
  for (const p of yearPays || []) {
    const m = (p.payment_date || '').slice(5, 7);
    if (m) monthMap[m] = (monthMap[m] || 0) + p.amount;
  }
  const monthlyRevenue = Object.keys(monthMap).sort().map(m => ({ month: m, total: monthMap[m] }));

  res.json({
    year: activeYear,
    tuition: { expected: tuitionExpected, paid: tuitionPaidYear, today: tuitionPaidToday },
    transactions: { entries: entriesYear, entriesToday, expenses: expensesYear, expensesToday },
    counts: { students: studentCount || 0, classes: classCount || 0 },
    recentPayments: (recentPayments || []).map(p => ({
      ...p,
      first_name: p.enrollments?.students?.first_name,
      last_name: p.enrollments?.students?.last_name,
      class_name: p.enrollments?.classes?.name,
      tuition_fee: p.enrollments?.classes?.tuition_fee,
      paid_total: payTotals[p.enrollment_id] || 0,
      balance: (p.enrollments?.classes?.tuition_fee || 0) - (payTotals[p.enrollment_id] || 0)
    })),
    recentTx: recentTx || [],
    monthlyRevenue
  });
}));

/* ---------------- GRADES / BULLETINS ---------------- */
app.get('/api/grades', auth(), ah(async (req, res) => {
  const { class_id, period_id, evaluation_id } = req.query;
  if (!class_id) return res.status(400).json({ error: 'class_id requis' });
  if (!(await assertClassAccess(req.user, class_id))) return res.status(403).json({ error: 'Accès refusé à cette classe' });
  const { data: cls } = await supabase.from('classes').select('id, cycle_id').eq('id', class_id).maybeSingle();

  const { data: enrRows } = await supabase.from('enrollments')
    .select('id, students(id, first_name, last_name)').eq('class_id', class_id).eq('status', 'actif');
  const enrollments = (enrRows || []).map(e => ({
    enrollment_id: e.id, student_id: e.students?.id, first_name: e.students?.first_name, last_name: e.students?.last_name
  })).sort((a, b) => a.last_name.localeCompare(b.last_name));
  const enrIds = enrollments.map(e => e.enrollment_id);

  let subjects = [];
  let evaluation = null;
  let gradeRows = [];

  if (evaluation_id) {
    const { data: ev } = await supabase.from('evaluations')
      .select('*, subjects(name, coefficient)').eq('id', evaluation_id).maybeSingle();
    if (ev) {
      evaluation = {
        ...ev, subject_name: ev.subjects?.name,
        coefficient: ev.subjects?.coefficient
      };
      const periodId = ev.period_id;
      if (enrIds.length) {
        const { data } = await supabase.from('grades')
          .select('*').eq('evaluation_id', evaluation_id).in('enrollment_id', enrIds);
        gradeRows = data || [];
      }
      const subs = await classSubjects(class_id, cls);
      subjects = subs.filter(s => s.id === ev.subject_id);
    }
  } else {
    if (!period_id) return res.status(400).json({ error: 'period_id ou evaluation_id requis' });
    if (enrIds.length) {
      const { data } = await supabase.from('grades')
        .select('*').eq('period_id', period_id).in('enrollment_id', enrIds);
      gradeRows = data || [];
    }
    subjects = await classSubjects(class_id);
  }

  const { data: period } = period_id ? await supabase.from('periods').select('*').eq('id', period_id).maybeSingle() : { data: null };
  res.json({ enrollments, grades: gradeRows, subjects, evaluation, period });
}));

app.post('/api/grades', auth(['admin', 'secretaire', 'professeur']), ah(async (req, res) => {
  const { enrollment_id, subject_id, period_id, evaluation_id, value } = req.body || {};
  if (!enrollment_id || !subject_id || value == null) return res.status(400).json({ error: 'Champs requis' });
  if (value < 0 || value > 20) return res.status(400).json({ error: 'Note invalide (0-20)' });
  const pid = period_id || (evaluation_id
    ? (await supabase.from('evaluations').select('period_id').eq('id', evaluation_id).maybeSingle()).data?.period_id
    : null);
  if (!pid) return res.status(400).json({ error: 'Période requise' });

  if (req.user.role === 'professeur') {
    /* l'enseignant doit être affecté à la matière de la classe concernée */
    const { data: enr } = await supabase.from('enrollments')
      .select('class_id').eq('id', enrollment_id).maybeSingle();
    const clsId = enr?.class_id;
    if (!clsId) return res.status(400).json({ error: 'Inscription introuvable' });
    const { data: assign } = await supabase.from('teacher_subjects')
      .select('id').eq('teacher_user_id', req.user.id).eq('class_id', clsId).eq('subject_id', subject_id).maybeSingle();
    if (!assign) return res.status(403).json({ error: 'Vous ne gérez pas cette matière dans cette classe' });
  }

  const isAdmin = req.user.role === 'admin';
  if (!isAdmin) {
    const locked = await isGradeLocked(evaluation_id, pid);
    if (locked) {
      const viaEval = evaluation_id
        ? 'Évaluation verrouillée ou expirée — seuls les administrateurs peuvent modifier'
        : 'Période verrouillée ou expirée — seuls les administrateurs peuvent modifier';
      return res.status(403).json({ error: viaEval });
    }
  }

  const query = supabase.from('grades')
    .select('id').eq('enrollment_id', enrollment_id).eq('subject_id', subject_id).eq('period_id', pid);
  const { data: existing } = evaluation_id ? await query.eq('evaluation_id', evaluation_id).maybeSingle() : await query.maybeSingle();
  const payload = { value };
  if (evaluation_id) payload.evaluation_id = evaluation_id;
  if (existing) {
    await supabase.from('grades').update(payload).eq('id', existing.id);
  } else {
    const { error } = await supabase.from('grades')
      .insert({ enrollment_id, subject_id, period_id: pid, value, evaluation_id: evaluation_id || null });
    if (error) return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true });
}));

app.get('/api/bulletins', auth(), ah(async (req, res) => {
  const { class_id, period_id, group_name, mode = 'sequence' } = req.query;
  if (!class_id) return res.status(400).json({ error: 'class_id requis' });
  if (!(await assertClassAccess(req.user, class_id))) return res.status(403).json({ error: 'Accès refusé à cette classe' });

  const { data: cls } = await supabase.from('classes')
    .select('*, levels(name)').eq('id', class_id).maybeSingle();
  if (!cls) return res.status(404).json({ error: 'Classe introuvable' });
  const yearId = cls.academic_year_id;

  /* Périodes couvertes par le bulletin */
  let periods = [];
  let period = null;
  if (mode === 'sequence' && period_id) {
    const { data: p } = await supabase.from('periods').select('*').eq('id', period_id).maybeSingle();
    period = p;
    periods = p ? [p] : [];
  } else if (mode === 'trimestre' && group_name) {
    const { data } = await supabase.from('periods')
      .select('*').eq('academic_year_id', yearId).eq('group_name', group_name).order('sort_order');
    periods = data || [];
  } else {
    const { data } = await supabase.from('periods')
      .select('*').eq('academic_year_id', yearId).order('sort_order');
    periods = data || [];
  }
  if (!periods.length) return res.status(400).json({ error: 'Aucune période pour ce bulletin' });
  const periodIds = periods.map(p => p.id);
  const locked = periods.some(p => p.locked);

  const { data: enrRows } = await supabase.from('enrollments')
    .select('id, students(id, first_name, last_name, gender)').eq('class_id', class_id).eq('status', 'actif');
  const enrollments = (enrRows || []).map(e => ({
    enrollment_id: e.id, student_id: e.students?.id, first_name: e.students?.first_name, last_name: e.students?.last_name, gender: e.students?.gender
  })).sort((a, b) => a.last_name.localeCompare(b.last_name));
  const enrIds = enrollments.map(e => e.enrollment_id);

  /* Notes pour toutes les périodes couvertes */
  let gradeRows = [];
  if (enrIds.length) {
    const { data } = await supabase.from('grades')
      .select('enrollment_id, subject_id, period_id, value, subjects(name, coefficient)')
      .in('period_id', periodIds).in('enrollment_id', enrIds);
    gradeRows = data || [];
  }

  /* Matières de la classe avec coefficient (surcharges classe > cycle > établissement) */
  const subjectMap = {};
  for (const s of await classSubjects(class_id, cls)) {
    subjectMap[s.id] = s;
  }

  /* Appréciations (période courante en mode séquence) */
  let appMap = {};
  if (mode === 'sequence' && period_id) {
    const { data: apps } = await supabase.from('appreciations')
      .select('enrollment_id, text').eq('period_id', period_id).in('enrollment_id', enrIds);
    for (const a of apps || []) appMap[a.enrollment_id] = a.text;
  }
  const { data: obsRow } = await supabase.from('class_observations')
    .select('text').eq('class_id', class_id).eq('period_id', mode === 'sequence' && period_id ? period_id : (periods[0]?.id || 0)).maybeSingle();

  const bulletins = enrollments.map(e => {
    const gs = gradeRows.filter(g => g.enrollment_id === e.enrollment_id);
    /* moyenne d'une matière sur les périodes couvertes */
    const subjAverages = {};
    for (const g of gs) {
      if (subjAverages[g.subject_id]) { subjAverages[g.subject_id].sum += g.value; subjAverages[g.subject_id].count += 1; }
      else subjAverages[g.subject_id] = { sum: g.value, count: 1 };
    }
    let totalCoef = 0, sumWeighted = 0;
    const rows = Object.keys(subjectMap).map(sid => {
      const sub = subjectMap[sid];
      const agg = subjAverages[sid];
      let value = null;
      if (agg) value = Math.round((agg.sum / agg.count) * 100) / 100;
      const weighted = value != null ? value * sub.coefficient : 0;
      if (value != null) { totalCoef += sub.coefficient; sumWeighted += weighted; }
      return { subject: sub.name, coefficient: sub.coefficient, value, weighted: Math.round(weighted * 100) / 100 };
    }).sort((a, b) => a.subject.localeCompare(b.subject));
    const average = totalCoef ? Math.round((sumWeighted / totalCoef) * 100) / 100 : null;
    return { ...e, rows, totalCoef, sumWeighted: Math.round(sumWeighted * 100) / 100, average, appreciation: appMap[e.enrollment_id] || '' };
  });

  /* Rangs et mentions */
  const ranked = [...bulletins].filter(b => b.average != null).sort((a, b) => b.average - a.average);
  const rankMap = {};
  ranked.forEach((b, i) => { rankMap[b.enrollment_id] = i + 1; });
  bulletins.forEach(b => { b.rank = b.average != null ? rankMap[b.enrollment_id] : null; b.mention = mention(b.average); });

  const { data: school } = await supabase.from('school').select('*').eq('id', 1).maybeSingle();
  const { data: year } = await supabase.from('academic_years').select('label').eq('id', yearId).maybeSingle();

  res.json({
    bulletins,
    classInfo: { ...cls, level_name: cls?.levels?.name },
    periods,
    period,
    locked,
    observation: obsRow?.text || '',
    school: schoolPublic(school), year_label: year?.label,
    mode, group_name: group_name || ''
  });
}));

/* ---------------- DOCUMENTS DATA ---------------- */
app.get('/api/receipts/:id', auth(), ah(async (req, res) => {
  const { data: p } = await supabase.from('tuition_payments')
    .select('*, enrollments(id, students(first_name, last_name, gender, birth_date, parent_name), classes(name, tuition_fee, levels(name)), academic_years(label)), users(full_name)')
    .eq('id', req.params.id).maybeSingle();
  if (!p) return res.status(404).json({ error: 'Reçu introuvable' });
  const enrollmentId = p.enrollments?.id;
  const stats = await paymentStats(enrollmentId);
  const { data: payments } = await supabase.from('tuition_payments')
    .select('receipt_number, amount, payment_date').eq('enrollment_id', enrollmentId).order('payment_date');
  const { data: school } = await supabase.from('school').select('*').eq('id', 1).maybeSingle();
  res.json({
    receipt: {
      ...p, enrollment_id: enrollmentId,
      first_name: p.enrollments?.students?.first_name,
      last_name: p.enrollments?.students?.last_name,
      gender: p.enrollments?.students?.gender,
      birth_date: p.enrollments?.students?.birth_date,
      parent_name: p.enrollments?.students?.parent_name,
      class_name: p.enrollments?.classes?.name,
      level_name: p.enrollments?.classes?.levels?.name,
      tuition_fee: p.enrollments?.classes?.tuition_fee,
      year_label: p.enrollments?.academic_years?.label,
      recorder_name: p.users?.full_name
    },
    school: schoolPublic(school),
    stats: { ...stats, payments: payments || [] }
  });
}));

app.get('/api/transactions/:id', auth(), ah(async (req, res) => {
  const { data: t } = await supabase.from('transactions')
    .select('*, users(full_name)').eq('id', req.params.id).maybeSingle();
  if (!t) return res.status(404).json({ error: 'Transaction introuvable' });
  const { data: school } = await supabase.from('school').select('*').eq('id', 1).maybeSingle();
  res.json({ transaction: { ...t, recorder_name: t.users?.full_name }, school: schoolPublic(school) });
}));

app.get('/api/class-list/:id', auth(), ah(async (req, res) => {
  const { data: cls } = await supabase.from('classes')
    .select('*, levels(name)').eq('id', req.params.id).maybeSingle();
  if (!cls) return res.status(404).json({ error: 'Classe introuvable' });
  const { data: students } = await supabase.from('enrollments')
    .select('students(last_name, first_name, gender, birth_date, parent_name, parent_phone)')
    .eq('class_id', req.params.id).eq('status', 'actif');
  const { data: school } = await supabase.from('school').select('*').eq('id', 1).maybeSingle();
  const { data: year } = await supabase.from('academic_years').select('label').eq('id', cls.academic_year_id).maybeSingle();
  res.json({
    classInfo: { ...cls, level_name: cls.levels?.name },
    students: (students || []).map(s => s.students).filter(Boolean),
    school: schoolPublic(school), year_label: year?.label
  });
}));

/* ---------------- RÉGLAGES (verrouillage auto) ---------------- */
app.get('/api/settings', auth(), ah(async (req, res) => {
  const { data } = await supabase.from('settings').select('key, value');
  const map = {};
  for (const s of data || []) map[s.key] = s.value;
  res.json({ grade_lock_days: Number(map.grade_lock_days) || 0 });
}));

app.put('/api/settings', adminOnly, ah(async (req, res) => {
  const { grade_lock_days = 0 } = req.body || {};
  const val = Math.max(0, Number(grade_lock_days) || 0);
  const { data: existing } = await supabase.from('settings')
    .select('key').eq('key', 'grade_lock_days').maybeSingle();
  if (existing) {
    await supabase.from('settings').update({ value: String(val) }).eq('key', 'grade_lock_days');
  } else {
    const { error } = await supabase.from('settings').insert({ key: 'grade_lock_days', value: String(val) });
    if (error) return res.status(500).json({ error: error.message });
  }
  res.json({ grade_lock_days: val });
}));

async function gradeLockDays() {
  const { data } = await supabase.from('settings')
    .select('value').eq('key', 'grade_lock_days').maybeSingle();
  return Number(data?.value) || 0;
}

/* Vérifie verrouillage manuel + automatique (période/évaluation datée trop ancienne) */
async function isGradeLocked(evaluationId, periodId) {
  const table = evaluationId ? 'evaluations' : 'periods';
  const id = evaluationId || periodId;
  const { data: rec } = await supabase.from(table).select('locked').eq('id', id).maybeSingle();
  if (rec?.locked) return true;
  const lockDays = await gradeLockDays();
  if (lockDays > 0) {
    try {
      const { data: d } = await supabase.from(table).select('date').eq('id', id).maybeSingle();
      if (d?.date) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - lockDays);
        if (new Date(`${d.date}T00:00:00`) < cutoff) return true;
      }
    } catch { /* colonne date absente (migration 0003 non appliquée) */ }
  }
  return false;
}

/* Matières & coefficients d'une classe avec surcharges : classe > cycle > établissement */
async function classSubjects(classId, cls) {
  const cycleId = cls?.cycle_id != null ? cls.cycle_id
    : (await supabase.from('classes').select('cycle_id').eq('id', classId).maybeSingle()).data?.cycle_id;
  const [cs, cys] = await Promise.all([
    supabase.from('class_subjects')
      .select('subject_id, coefficient, subjects(name, coefficient)').eq('class_id', classId),
    cycleId ? supabase.from('cycle_subjects')
      .select('subject_id, coefficient, subjects(name, coefficient)').eq('cycle_id', cycleId) : { data: [] }
  ]);
  const cycleMap = {};
  for (const r of cys.data || []) cycleMap[r.subject_id] = r.coefficient != null ? r.coefficient : r.subjects?.coefficient;
  return (cs.data || []).map(r => ({
    id: r.subject_id,
    name: r.subjects?.name,
    coefficient: r.coefficient != null ? r.coefficient : (cycleMap[r.subject_id] != null ? cycleMap[r.subject_id] : r.subjects?.coefficient)
  })).sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------------- CYCLES ---------------- */
app.get('/api/cycles', auth(), ah(async (req, res) => {
  const { data } = await supabase.from('cycles').select('*').order('sort_order').order('id');
  res.json(data || []);
}));

app.post('/api/cycles', adminOnly, ah(async (req, res) => {
  const { name, sort_order = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const { data, error } = await supabase.from('cycles')
    .insert({ name, sort_order }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

app.put('/api/cycles/:id', adminOnly, ah(async (req, res) => {
  const body = {};
  if (req.body?.name !== undefined) body.name = req.body.name;
  if (req.body?.sort_order !== undefined) body.sort_order = req.body.sort_order;
  if (Object.keys(body).length) await supabase.from('cycles').update(body).eq('id', req.params.id);
  res.json({ ok: true });
}));

app.delete('/api/cycles/:id', adminOnly, ah(async (req, res) => {
  const { data: cls } = await supabase.from('classes')
    .select('id').eq('cycle_id', req.params.id).limit(1);
  if (cls && cls.length) {
    return res.status(409).json({ error: 'Ce cycle contient des classes.', linked: true });
  }
  await supabase.from('cycles').delete().eq('id', req.params.id);
  res.json({ ok: true });
}));

/* Matières & coefficients configurés au niveau d'un cycle (surcharge : classe > cycle > établissement) */
app.get('/api/cycles/:id/subjects', auth(), ah(async (req, res) => {
  const { data: cs } = await supabase.from('cycle_subjects')
    .select('subject_id, coefficient, subjects(name, coefficient)')
    .eq('cycle_id', req.params.id);
  res.json((cs || []).map(r => ({
    subject_id: r.subject_id,
    name: r.subjects?.name,
    coefficient: r.coefficient != null ? r.coefficient : r.subjects?.coefficient,
    link_id: r.subject_id
  })).sort((a, b) => a.name.localeCompare(b.name)));
}));

app.post('/api/cycles/:id/subjects', adminOnly, ah(async (req, res) => {
  const { subject_ids } = req.body || {};
  if (!Array.isArray(subject_ids)) return res.status(400).json({ error: 'subject_ids requis' });
  await supabase.from('cycle_subjects').delete().eq('cycle_id', req.params.id);
  if (subject_ids.length) {
    const coeffs = req.body.coefficients || {};
    await supabase.from('cycle_subjects')
      .insert(subject_ids.map(subject_id => ({
        cycle_id: req.params.id, subject_id,
        coefficient: coeffs[subject_id] != null ? Number(coeffs[subject_id]) : null
      })));
  }
  res.json({ ok: true });
}));

/* ---------------- AFFECTATIONS ENSEIGNANTS (matière → classe) ---------------- */
app.get('/api/classes/:id/teachers', auth(), ah(async (req, res) => {
  const { data } = await supabase.from('teacher_subjects')
    .select('*, subjects(name), users(full_name)')
    .eq('class_id', req.params.id);
  res.json((data || []).map(r => ({
    id: r.id, class_id: r.class_id, subject_id: r.subject_id,
    teacher_user_id: r.teacher_user_id,
    subject_name: r.subjects?.name, teacher_name: r.users?.full_name
  })).sort((a, b) => a.subject_name.localeCompare(b.subject_name)));
}));

app.post('/api/classes/:id/teachers', adminOnly, ah(async (req, res) => {
  const { subject_id, teacher_user_id } = req.body || {};
  if (!subject_id || !teacher_user_id) return res.status(400).json({ error: 'Matière et enseignant requis' });
  const { data: existing } = await supabase.from('teacher_subjects')
    .select('id').eq('class_id', req.params.id).eq('subject_id', subject_id).maybeSingle();
  if (existing) {
    await supabase.from('teacher_subjects').update({ teacher_user_id }).eq('id', existing.id);
  } else {
    const { error } = await supabase.from('teacher_subjects')
      .insert({ class_id: req.params.id, subject_id, teacher_user_id });
    if (error) return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true });
}));

app.delete('/api/classes/:id/teachers/:linkId', adminOnly, ah(async (req, res) => {
  await supabase.from('teacher_subjects').delete().eq('id', req.params.linkId);
  res.json({ ok: true });
}));

/* ---------------- MORATOIRES ---------------- */
app.get('/api/moratoires', auth(), ah(async (req, res) => {
  const { enrollment_id, class_id } = req.query;
  let query = supabase.from('moratoires')
    .select('*, enrollments(id, students(first_name, last_name), classes(name)), users(full_name)')
    .order('created_at', { ascending: false });
  if (enrollment_id) query = query.eq('enrollment_id', enrollment_id);
  if (class_id) {
    const { data: enr } = await supabase.from('enrollments').select('id').eq('class_id', class_id);
    const ids = (enr || []).map(e => e.id);
    if (ids.length) query = query.in('enrollment_id', ids); else return res.json([]);
  }
  const { data } = await query;
  res.json((data || []).map(m => ({
    ...m,
    first_name: m.enrollments?.students?.first_name,
    last_name: m.enrollments?.students?.last_name,
    class_name: m.enrollments?.classes?.name,
    created_by_name: m.users?.full_name
  })));
}));

app.post('/api/moratoires', canWrite, ah(async (req, res) => {
  const { enrollment_id, reason = '', start_date, end_date, note = '' } = req.body || {};
  if (!enrollment_id || !reason) return res.status(400).json({ error: 'Élève et motif requis' });
  const { data, error } = await supabase.from('moratoires')
    .insert({
      enrollment_id, reason,
      start_date: start_date || new Date().toISOString().slice(0, 10),
      end_date: end_date || null, note, created_by: req.user.id
    }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

app.put('/api/moratoires/:id', canWrite, ah(async (req, res) => {
  const body = {};
  if (req.body?.reason !== undefined) body.reason = req.body.reason;
  if (req.body?.start_date !== undefined) body.start_date = req.body.start_date;
  if (req.body?.end_date !== undefined) body.end_date = req.body.end_date || null;
  if (req.body?.note !== undefined) body.note = req.body.note;
  if (Object.keys(body).length) await supabase.from('moratoires').update(body).eq('id', req.params.id);
  res.json({ ok: true });
}));

app.delete('/api/moratoires/:id', canWrite, ah(async (req, res) => {
  await supabase.from('moratoires').delete().eq('id', req.params.id);
  res.json({ ok: true });
}));

/* ---------------- ÉVALUATIONS ---------------- */
app.get('/api/evaluations', auth(), ah(async (req, res) => {
  const { class_id, period_id } = req.query;
  const visible = await visibleClassIds(req.user);
  let query = supabase.from('evaluations')
    .select('*, subjects(name), classes(name), periods(name, group_name, locked)')
    .order('date', { ascending: false }).order('id', { ascending: false });
  if (visible !== null) query = query.in('class_id', visible);
  if (class_id) query = query.eq('class_id', class_id);
  if (period_id) query = query.eq('period_id', period_id);
  const { data } = await query;
  const rows = data || [];
  const ids = rows.map(e => e.id);
  let countMap = {};
  if (ids.length) {
    const { data: gr } = await supabase.from('grades')
      .select('evaluation_id').in('evaluation_id', ids).neq('evaluation_id', null);
    for (const g of gr || []) countMap[g.evaluation_id] = (countMap[g.evaluation_id] || 0) + 1;
  }
  res.json(rows.map(e => ({
    ...e,
    subject_name: e.subjects?.name,
    class_name: e.classes?.name,
    period_name: e.periods?.name,
    period_group: e.periods?.group_name,
    period_locked: e.periods?.locked,
    grade_count: countMap[e.id] || 0
  })));
}));

app.post('/api/evaluations', canWrite, ah(async (req, res) => {
  const { name, subject_id, period_id, class_ids, class_id, date } = req.body || {};
  if (!name || !subject_id || !period_id) return res.status(400).json({ error: 'Nom, matière et période requis' });
  const ids = class_ids && class_ids.length ? class_ids : (class_id ? [class_id] : []);
  if (!ids.length) return res.status(400).json({ error: 'Au moins une classe requise' });
  const { data, error } = await supabase.from('evaluations')
    .insert(ids.map(cid => ({
      name, subject_id, period_id, class_id: cid, date: date || null, created_by: req.user.id
    }))).select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ evaluations: data });
}));

app.put('/api/evaluations/:id', adminOnly, ah(async (req, res) => {
  const body = {};
  if (req.body?.name !== undefined) body.name = req.body.name;
  if (req.body?.date !== undefined) body.date = req.body.date || null;
  if (req.body?.locked !== undefined) body.locked = !!req.body.locked;
  if (Object.keys(body).length) await supabase.from('evaluations').update(body).eq('id', req.params.id);
  res.json({ ok: true });
}));

app.delete('/api/evaluations/:id', adminOnly, ah(async (req, res) => {
  const { data: gr } = await supabase.from('grades')
    .select('id').eq('evaluation_id', req.params.id).limit(1);
  if (gr && gr.length) {
    return res.status(409).json({ error: 'Cette évaluation contient des notes saisies.', linked: true });
  }
  await supabase.from('evaluations').delete().eq('id', req.params.id);
  res.json({ ok: true });
}));

/* ---------------- APPRÉCIATIONS & OBSERVATIONS ---------------- */
app.get('/api/appreciations', auth(), ah(async (req, res) => {
  const { class_id, period_id } = req.query;
  if (!class_id || !period_id) return res.status(400).json({ error: 'class_id et period_id requis' });
  const { data: enr } = await supabase.from('enrollments')
    .select('id').eq('class_id', class_id).eq('status', 'actif');
  const ids = (enr || []).map(e => e.id);
  let rows = [];
  if (ids.length) {
    const { data } = await supabase.from('appreciations')
      .select('*').eq('period_id', period_id).in('enrollment_id', ids);
    rows = data || [];
  }
  const map = {};
  for (const a of rows) map[a.enrollment_id] = a.text;
  const { data: obs } = await supabase.from('class_observations')
    .select('*').eq('class_id', class_id).eq('period_id', period_id).maybeSingle();
  res.json({ appreciations: map, observation: obs?.text || '' });
}));

app.post('/api/appreciations', canWrite, ah(async (req, res) => {
  const { enrollment_id, period_id, text = '' } = req.body || {};
  if (!enrollment_id || !period_id) return res.status(400).json({ error: 'Champs requis' });
  const { data: existing } = await supabase.from('appreciations')
    .select('id').eq('enrollment_id', enrollment_id).eq('period_id', period_id).maybeSingle();
  if (existing) {
    await supabase.from('appreciations').update({ text }).eq('id', existing.id);
  } else {
    const { error } = await supabase.from('appreciations')
      .insert({ enrollment_id, period_id, text });
    if (error) return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true });
}));

app.post('/api/class-observations', canWrite, ah(async (req, res) => {
  const { class_id, period_id, text = '' } = req.body || {};
  if (!class_id || !period_id) return res.status(400).json({ error: 'Champs requis' });
  const { data: existing } = await supabase.from('class_observations')
    .select('id').eq('class_id', class_id).eq('period_id', period_id).maybeSingle();
  if (existing) {
    await supabase.from('class_observations').update({ text }).eq('id', existing.id);
  } else {
    const { error } = await supabase.from('class_observations')
      .insert({ class_id, period_id, text });
    if (error) return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true });
}));

/* ---------------- CERTIFICAT DE SCOLARITÉ ---------------- */
app.get('/api/certificates/:studentId', auth(), ah(async (req, res) => {
  const { data: student } = await supabase.from('students')
    .select('*').eq('id', req.params.studentId).maybeSingle();
  if (!student) return res.status(404).json({ error: 'Élève introuvable' });
  const yearId = await activeYearId();
  const { data: enr } = await supabase.from('enrollments')
    .select('*, classes(name, levels(name)), academic_years(label)')
    .eq('student_id', req.params.studentId).eq('academic_year_id', yearId).maybeSingle();
  const { data: school } = await supabase.from('school').select('*').eq('id', 1).maybeSingle();
  const year = enr?.academic_years || null;
  const level = enr?.classes?.levels?.name || null;
  res.json({
    student,
    class_name: enr?.classes?.name || null,
    level_name: level,
    year_label: year?.label || null,
    enrolled: !!enr,
    school: schoolPublic(school)
  });
}));

/* ---------------- RAPPORTS FINANCIERS ---------------- */
app.get('/api/reports', auth(), ah(async (req, res) => {
  const { from, to, class_id, student_id, year_id } = req.query;
  const yearId = Number(year_id) || await activeYearId();

  const inRange = (date) => (!from || date >= from) && (!to || date <= to);

  let payQuery = supabase.from('tuition_payments')
    .select('id, amount, payment_date, method, receipt_number, category, note, enrollment_id, enrollments(id, student_id, classes(name), students(first_name, last_name))')
    .order('payment_date', { ascending: false });
  if (from) payQuery = payQuery.gte('payment_date', from);
  if (to) payQuery = payQuery.lte('payment_date', to);
  const { data: payRows } = await payQuery;
  const payments = (payRows || []).filter(p => {
    if (student_id && p.enrollments?.student_id !== Number(student_id)) return false;
    if (class_id && p.enrollments?.classes?.id !== Number(class_id)) return false;
    return true;
  }).map(p => ({
    ...p,
    first_name: p.enrollments?.students?.first_name,
    last_name: p.enrollments?.students?.last_name,
    class_name: p.enrollments?.classes?.name
  }));

  let txQuery = supabase.from('transactions')
    .select('*').order('transaction_date', { ascending: false });
  if (from) txQuery = txQuery.gte('transaction_date', from);
  if (to) txQuery = txQuery.lte('transaction_date', to);
  const { data: txRows } = await txQuery;
  const transactions = (txRows || []).filter(t => inRange(t.transaction_date));

  const tuitionTotal = payments.reduce((s, p) => s + p.amount, 0);
  const entries = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);

  /* Vue d'ensemble scolarité : attendu vs payé vs restant */
  let enrQuery = supabase.from('enrollments')
    .select('id, student_id, status, classes(id, name, tuition_fee), students(first_name, last_name)')
    .eq('academic_year_id', yearId).eq('status', 'actif');
  if (class_id) enrQuery = enrQuery.eq('class_id', class_id);
  if (student_id) enrQuery = enrQuery.eq('student_id', student_id);
  const { data: enrRows } = await enrQuery;
  const enrIds = (enrRows || []).map(e => e.id);
  let payTotals = {};
  if (enrIds.length) {
    const { data: allPays } = await supabase.from('tuition_payments')
      .select('enrollment_id, amount').in('enrollment_id', enrIds);
    for (const p of allPays || []) payTotals[p.enrollment_id] = (payTotals[p.enrollment_id] || 0) + p.amount;
  }
  const overview = (enrRows || []).map(e => {
    const tuition = e.classes?.tuition_fee || 0;
    const paid = payTotals[e.id] || 0;
    return {
      enrollment_id: e.id, student_id: e.student_id,
      first_name: e.students?.first_name, last_name: e.students?.last_name,
      class_name: e.classes?.name, tuition, paid, remaining: tuition - paid
    };
  }).sort((a, b) => a.last_name.localeCompare(b.last_name));

  const global = {
    expected: overview.reduce((s, o) => s + o.tuition, 0),
    paid: overview.reduce((s, o) => s + o.paid, 0),
    remaining: overview.reduce((s, o) => s + o.remaining, 0)
  };

  res.json({
    payments, transactions,
    totals: { tuition: tuitionTotal, entries, expenses, balance: tuitionTotal + entries - expenses },
    overview, global
  });
}));

/* ---------------- MENTION ---------------- */
function mention(avg) {
  if (avg == null) return null;
  if (avg >= 18) return 'Félicitations';
  if (avg >= 16) return 'Très bien';
  if (avg >= 14) return 'Bien';
  if (avg >= 12) return 'Assez bien';
  if (avg >= 10) return 'Passable';
  return 'Insuffisant';
}

export default app;
