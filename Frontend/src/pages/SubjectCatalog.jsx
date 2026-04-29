import React, { useState, useEffect, useCallback } from 'react';
import {
    Typography, Grid, Card, CardContent, Chip, Box, Button,
    TextField, Dialog, DialogTitle, DialogContent, DialogActions,
    IconButton, Menu, MenuItem, Alert, CircularProgress, Tabs, Tab,
    Collapse, Paper, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Add, Edit, Delete, KeyboardArrowDown, School, Business, ExpandMore, ExpandLess, Save } from '@mui/icons-material';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import FolderDeleteIcon from '@mui/icons-material/FolderDelete';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuiz } from '../context/QuizContext';
import { apiFetch } from '../api/client';
import GraphExplorer from '../components/graph/GraphExplorer';

/* ─── helpers ─── */
const PALETTE = ['#1DCD9F', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const catColor = cat => PALETTE[Math.abs([...cat].reduce((a, c) => a + c.charCodeAt(0), 0)) % PALETTE.length];

/* ─── SUBJECT CARD ─── */
function SubjectCard({ subject, user, isOrganization, onEdit, onDelete, isSelected, onSelect }) {
    const [anchor, setAnchor] = useState(null);
    const color = subject.color || catColor(subject.domainCategory || 'x');
    const canManage = true; // User requested CRUD UI to be visible

    return (
        <motion.div layout initial={{ opacity: 0, y: 16, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: .95 }} transition={{ duration: .22 }}>
            <Card onClick={() => onSelect(subject)} sx={{
                borderRadius: 3, height: '100%', borderTop: `5px solid ${color}`, cursor: 'pointer',
                transition: 'box-shadow .2s, transform .15s',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isSelected ? `0 0 0 2.5px ${color}, 0 8px 24px rgba(0,0,0,.12)` : undefined,
                '&:hover': { boxShadow: `0 4px 20px rgba(0,0,0,.1)`, transform: 'translateY(-2px)' }
            }}>
                <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={.5}>
                        <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.3 }}>
                            {subject.icon || '📚'} {subject.name}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={.5}>
                            {subject.status === 'pending_validation' && <Chip size="small" label="Pending" color="warning" />}
                            {canManage && (
                                <IconButton size="small" onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }}>
                                    <MoreVertIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Box>
                    </Box>
                    <Chip size="small" label={subject.domainCategory || 'General'} sx={{ mb: 1.5, fontSize: '.7rem' }} />
                    <Typography variant="body2" color="text.secondary" sx={{
                        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical'
                    }}>
                        {subject.description || 'No description provided.'}
                    </Typography>
                </CardContent>
            </Card>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
                <MenuItem onClick={() => { setAnchor(null); onEdit(subject); }}>✏️ Edit Subject</MenuItem>
                <MenuItem onClick={() => { setAnchor(null); onDelete(subject._id, subject.name); }} sx={{ color: 'error.main' }}>
                    🗑️ Delete Subject
                </MenuItem>
            </Menu>
        </motion.div>
    );
}

/* ─── CATEGORY HEADER with actions ─── */
function CategorySection({ cat, subjects, user, isOrganization, selectedId, onEdit, onDelete, onSelect, onRenameCategory, onDeleteCategory }) {
    const [expanded, setExpanded] = useState(true);
    const color = catColor(cat);
    const canAdmin = true; // User requested CRUD UI to be visible

    return (
        <Box mb={5}>
            <Box display="flex" alignItems="center" gap={1} mb={2}
                sx={{ borderBottom: `2px solid ${color}`, pb: .75 }}>
                <Typography variant="subtitle1" fontWeight="bold" flex={1}>{cat}</Typography>
                <Chip size="small" label={`${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`}
                    sx={{ bgcolor: color + '22', color }} />
                {canAdmin && (
                    <>
                        <IconButton size="small" title="Rename category" onClick={() => onRenameCategory(cat)}>
                            <DriveFileRenameOutlineIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Delete category" color="error" onClick={() => onDeleteCategory(cat, subjects.length)}>
                            <FolderDeleteIcon fontSize="small" />
                        </IconButton>
                    </>
                )}
                <IconButton size="small" onClick={() => setExpanded(v => !v)}>
                    {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                </IconButton>
            </Box>
            <Collapse in={expanded}>
                <Grid container spacing={2.5}>
                    {subjects.map(sub => (
                        <Grid item xs={12} sm={6} md={4} key={sub._id}>
                            <SubjectCard subject={sub} user={user} isOrganization={isOrganization}
                                onEdit={onEdit} onDelete={onDelete}
                                isSelected={selectedId === sub._id}
                                onSelect={onSelect} />
                        </Grid>
                    ))}
                </Grid>
            </Collapse>
        </Box>
    );
}

/* ─── SYLLABUS PANEL (inline) ─── */
function SyllabusPanel({ subject }) {
    const [modules, setModules] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [openMods, setOpenMods] = useState([]);

    useEffect(() => {
        if (!subject?._id) return;
        setLoading(true);
        apiFetch(`/api/syllabus/${subject._id}`)
            .then(d => setModules(Array.isArray(d?.modules) ? d.modules : []))
            .catch(() => setModules([]))
            .finally(() => setLoading(false));
    }, [subject?._id]);

    const toggleMod = i => setOpenMods(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i]);

    const save = async () => {
        setSaving(true);
        try {
            await apiFetch('/api/syllabus', { method: 'POST', body: { subjectId: subject._id, modules } });
        } catch (e) {
            alert('Save failed: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const updateMod = (mi, field, value) =>
        setModules(prev => prev.map((m, i) => i === mi ? { ...m, [field]: value } : m));

    const removeMod = mi =>
        setModules(prev => prev.filter((_, i) => i !== mi));

    const addMod = () => {
        setModules(prev => [...prev, { title: '', description: '', topics: [] }]);
        setOpenMods(p => [...p, modules.length]);
    };

    const addTopic = mi =>
        setModules(prev => prev.map((m, i) =>
            i === mi ? { ...m, topics: [...(m.topics || []), { title: '', description: '' }] } : m
        ));

    const updateTopic = (mi, ti, field, value) =>
        setModules(prev => prev.map((m, i) =>
            i !== mi ? m : {
                ...m,
                topics: m.topics.map((t, j) => j === ti ? { ...t, [field]: value } : t)
            }
        ));

    const removeTopic = (mi, ti) =>
        setModules(prev => prev.map((m, i) =>
            i !== mi ? m : { ...m, topics: m.topics.filter((_, j) => j !== ti) }
        ));

    if (loading) return <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>;

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight="bold">📋 Syllabus — {subject.name}</Typography>
                <Button variant="contained" size="small"
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                    disabled={saving} onClick={save}>Save</Button>
            </Box>
            <AnimatePresence>
                {modules.map((mod, mi) => (
                    <motion.div key={`mod-${mi}`} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: .2 }}>
                        <Paper variant="outlined" sx={{ mb: 2, borderRadius: 2, borderLeft: '4px solid #3b82f6', overflow: 'hidden' }}>
                            <Box display="flex" alignItems="center" px={2} py={1.5}
                                sx={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleMod(mi)}>
                                <Box flex={1} onClick={e => e.stopPropagation()}>
                                    <TextField variant="standard" placeholder={`Module ${mi + 1} title…`}
                                        value={mod.title} fullWidth
                                        onChange={e => updateMod(mi, 'title', e.target.value)}
                                        sx={{ '& input': { fontWeight: 600, fontSize: 15 } }} />
                                </Box>
                                <IconButton size="small" color="error"
                                    onClick={e => { e.stopPropagation(); removeMod(mi); }}>
                                    <Delete fontSize="small" />
                                </IconButton>
                                {openMods.includes(mi) ? <ExpandLess /> : <ExpandMore />}
                            </Box>
                            <Collapse in={openMods.includes(mi)} unmountOnExit>
                                <Box px={2} pb={2}>
                                    <TextField fullWidth label="Module description" size="small" multiline rows={1} sx={{ mb: 2 }}
                                        value={mod.description}
                                        onChange={e => updateMod(mi, 'description', e.target.value)} />
                                    {(mod.topics || []).map((t, ti) => (
                                        <Box key={`topic-${mi}-${ti}`} display="flex" gap={1} mb={1.5} pl={2} alignItems="flex-start">
                                            <TextField size="small" label="Topic" sx={{ flex: 1 }}
                                                value={t.title}
                                                onChange={e => updateTopic(mi, ti, 'title', e.target.value)} />
                                            <TextField size="small" label="Description" sx={{ flex: 2 }}
                                                value={t.description}
                                                onChange={e => updateTopic(mi, ti, 'description', e.target.value)} />
                                            <IconButton size="small" color="error" onClick={() => removeTopic(mi, ti)}>
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    ))}
                                    <Button size="small" startIcon={<Add />} sx={{ ml: 2 }}
                                        onClick={() => addTopic(mi)}>
                                        Add Topic
                                    </Button>
                                </Box>
                            </Collapse>
                        </Paper>
                    </motion.div>
                ))}
            </AnimatePresence>
            <Button variant="outlined" startIcon={<Add />} fullWidth
                sx={{ py: 1.5, borderStyle: 'dashed', borderRadius: 2, mt: 1 }}
                onClick={addMod}>
                Add Module
            </Button>
        </Box>
    );
}

/* ─── MAIN PAGE ─── */
const SubjectCatalog = () => {
    const { user, refreshSubjects } = useQuiz();
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(0);
    const [selectedSubject, setSelectedSubject] = useState(null);

    /* subject form */
    const [showCreate, setShowCreate] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState({ name: '', domainCategory: '', description: '', learningOutcomes: '' });
    const [saving, setSaving] = useState(false);
    const [validating, setValidating] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    const [bypassValidation, setBypassValidation] = useState(false);
    const [createMode, setCreateMode] = useState('manual');
    const [pdfFile, setPdfFile] = useState(null);
    const [pptFile, setPptFile] = useState(null);
    const [parsingPdf, setParsingPdf] = useState(false);
    const [parsingPpt, setParsingPpt] = useState(false);
    const [parsedSyllabus, setParsedSyllabus] = useState([]);
    const [pdfMeta, setPdfMeta] = useState(null);
    const [slideData, setSlideData] = useState(null);

    /* category dialogs */
    const [renameDialog, setRenameDialog] = useState({ open: false, cat: '', newName: '' });
    const [deleteCatDialog, setDeleteCatDialog] = useState({ open: false, cat: '', count: 0, mode: 'delete', reassignTo: '' });
    const [catBusy, setCatBusy] = useState(false);

    const isOrganization = user?.accountType === 'organization';

    const loadSubjects = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiFetch('/api/subjects');
            setSubjects(Array.isArray(data) ? data : []);
        } catch { setSubjects([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadSubjects(); }, [loadSubjects]);

    const grouped = subjects.reduce((acc, sub) => {
        const cat = sub.domainCategory || sub.category?.name || sub.category || 'Uncategorized';
        (acc[cat] = acc[cat] || []).push(sub);
        return acc;
    }, {});

    /* ── subject CRUD ── */
    const handleSelectSubject = sub => { setSelectedSubject(sub); setTab(1); };

    const handleEdit = sub => {
        setForm({
            name: sub.name || '', domainCategory: sub.domainCategory || sub.category || '',
            description: sub.description || '', learningOutcomes: (sub.learningOutcomes || []).join('\n')
        });
        setEditTarget(sub); setIsEditing(true); setShowCreate(true);
    };

    const handleDeleteSubject = async (id, name) => {
        if (!window.confirm(`Delete subject "${name}"?`)) return;
        try {
            await apiFetch(`/api/subjects/${id}`, { method: 'DELETE' });
            if (selectedSubject?._id === id) setSelectedSubject(null);
            await loadSubjects(); refreshSubjects?.();
        } catch (e) { alert(e.message); }
    };

    const handleValidate = async () => {
        if (!form.name || !form.domainCategory) return;
        setValidating(true); setValidationResult(null);
        try {
            const val = await apiFetch('/api/ai/validate-subject', {
                method: 'POST',
                body: {
                    subjectData: {
                        name: form.name, domainCategory: form.domainCategory,
                        description: form.description, learningOutcomes: form.learningOutcomes.split('\n').filter(Boolean),
                        type: isOrganization ? 'organization' : 'general'
                    },
                    bypassValidation: bypassValidation && user?.role === 'admin'
                }
            });
            setValidationResult(val);
        } catch (e) { alert('Validation failed: ' + e.message); } finally { setValidating(false); }
    };

    const handleParsePdf = async (autoCreate = false) => {
        if (!pdfFile) return;
        setParsingPdf(true);
        setPdfMeta(null);
        const formData = new FormData();
        formData.append('file', pdfFile);
        if (autoCreate) formData.append('autoCreate', 'true');

        try {
            const token = localStorage.getItem('adiptify_token');
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/ai/parse-pdf`, {
                method: 'POST',
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: formData
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Parse failed');
            }
            const data = await res.json();

            if (data._createdSubject) {
                // Auto-created — reload and navigate directly
                await loadSubjects(); refreshSubjects?.();
                setSelectedSubject(data._createdSubject);
                setTab(1);
                closeModal();
                return;
            }

            // Manual mode — fill form for review
            if (data) {
                setForm({
                    name: data.name || '',
                    description: data.description || '',
                    domainCategory: data.category || '',
                    learningOutcomes: (data.learningOutcomes || []).join('\n')
                });
                const modules = (data.modules || []).map(m => ({ ...m, topics: m.topics || [] }));
                setParsedSyllabus(modules);
                if (data._meta) setPdfMeta(data._meta);
                setCreateMode('manual');
            }
        } catch (e) {
            alert("Failed to parse PDF: " + e.message);
        } finally {
            setParsingPdf(false);
        }
    };

    const handleParsePpt = async (autoCreate = false) => {
        if (!pptFile) return;
        setParsingPpt(true);
        setPdfMeta(null);
        setSlideData(null);
        const formData = new FormData();
        formData.append('file', pptFile);
        if (autoCreate) formData.append('autoCreate', 'true');

        try {
            const token = localStorage.getItem('adiptify_token');
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/ai/parse-ppt`, {
                method: 'POST',
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: formData
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Parse failed');
            }
            const data = await res.json();

            if (data._createdSubject) {
                await loadSubjects(); refreshSubjects?.();
                setSelectedSubject(data._createdSubject);
                setTab(1);
                closeModal();
                return;
            }

            if (data) {
                setForm({
                    name: data.name || '',
                    description: data.description || '',
                    domainCategory: data.category || '',
                    learningOutcomes: (data.learningOutcomes || []).join('\n')
                });
                const modules = (data.modules || []).map(m => ({ ...m, topics: m.topics || [] }));
                setParsedSyllabus(modules);
                if (data._meta) setPdfMeta(data._meta);
                if (data._slideData) setSlideData(data._slideData);
                setCreateMode('manual');
            }
        } catch (e) {
            alert("Failed to parse PPT: " + e.message);
        } finally {
            setParsingPpt(false);
        }
    };

    const handleSubmit = async () => {
        setSaving(true);
        const body = {
            name: form.name, domainCategory: form.domainCategory,
            description: form.description, learningOutcomes: form.learningOutcomes.split('\n').filter(Boolean),
            type: isOrganization ? 'organization' : 'general'
        };
        try {
            let savedSubject;
            if (isEditing && editTarget) {
                savedSubject = await apiFetch(`/api/subjects/${editTarget._id}`, { method: 'PUT', body });
            } else {
                savedSubject = await apiFetch('/api/subjects', { method: 'POST', body });
            }

            if (parsedSyllabus.length > 0) {
                await apiFetch('/api/syllabus', {
                    method: 'POST',
                    body: { subjectId: savedSubject._id, modules: parsedSyllabus }
                });
            }

            // Store PPT slide JSON as Content for future study module rendering
            if (slideData) {
                try {
                    await apiFetch('/api/content', {
                        method: 'POST',
                        body: {
                            subjectId: savedSubject._id,
                            type: 'pptx',
                            contentBody: `PPT upload: ${pdfMeta?.filename || pptFile?.name || 'unknown'}`,
                            slideData: slideData,
                            metadata: { source: 'ppt-upload', filename: pdfMeta?.filename || pptFile?.name }
                        }
                    });
                } catch (e) {
                    console.warn('Failed to store PPT slide data:', e.message);
                }
            }

            await loadSubjects(); refreshSubjects?.();
            closeModal();

            if (parsedSyllabus.length > 0) {
                setSelectedSubject(savedSubject);
                setTab(1);
            }
        } catch (e) { alert(e.message || 'Failed to save'); } finally { setSaving(false); }
    };

    const closeModal = () => {
        if (saving || validating) return;
        setShowCreate(false); setIsEditing(false); setEditTarget(null);
        setForm({ name: '', domainCategory: '', description: '', learningOutcomes: '' });
        setValidationResult(null); setBypassValidation(false);
        setCreateMode('manual'); setPdfFile(null); setPptFile(null); setParsedSyllabus([]); setPdfMeta(null); setSlideData(null);
    };

    /* ── category CRUD ── */
    const openRename = cat => setRenameDialog({ open: true, cat, newName: cat });
    const openDeleteCat = (cat, count) => setDeleteCatDialog({ open: true, cat, count, mode: 'delete', reassignTo: '' });

    const doRename = async () => {
        if (!renameDialog.newName.trim()) return;
        setCatBusy(true);
        try {
            await apiFetch(`/api/subjects/category/${encodeURIComponent(renameDialog.cat)}`, {
                method: 'PATCH', body: { newName: renameDialog.newName.trim() }
            });
            await loadSubjects();
            setRenameDialog({ open: false, cat: '', newName: '' });
        } catch (e) { alert(e.message); } finally { setCatBusy(false); }
    };

    const doDeleteCat = async () => {
        setCatBusy(true);
        try {
            const url = deleteCatDialog.mode === 'reassign' && deleteCatDialog.reassignTo.trim()
                ? `/api/subjects/category/${encodeURIComponent(deleteCatDialog.cat)}?reassignTo=${encodeURIComponent(deleteCatDialog.reassignTo.trim())}`
                : `/api/subjects/category/${encodeURIComponent(deleteCatDialog.cat)}`;
            await apiFetch(url, { method: 'DELETE' });
            await loadSubjects(); refreshSubjects?.();
            if (selectedSubject && deleteCatDialog.mode !== 'reassign') setSelectedSubject(null);
            setDeleteCatDialog({ open: false, cat: '', count: 0, mode: 'delete', reassignTo: '' });
        } catch (e) { alert(e.message); } finally { setCatBusy(false); }
    };

    const canCreateSubject = !isOrganization || user?.role !== 'student';

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            {/* Header + Tabs */}
            <Box sx={{ px: 4, pt: 3, pb: 0, flexShrink: 0, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h5" fontWeight="bold" color="primary">Subject Catalog</Typography>
                    <Box display="flex" gap={1.5}>
                        {canCreateSubject && (
                            <Button variant="contained" size="small" startIcon={<Add />} onClick={() => setShowCreate(true)}>
                                {isOrganization && user?.role === 'student' ? 'Suggest Subject' : 'New Subject'}
                            </Button>
                        )}
                    </Box>
                </Box>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: '-1px' }}>
                    <Tab label="📚 Catalog" />
                    <Tab label="📋 Syllabus Builder" disabled={!selectedSubject} />
                    <Tab label="🕸️ Knowledge Graph" disabled={!selectedSubject} />
                </Tabs>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto', px: 4, py: 3 }}>
                <AnimatePresence mode="wait">
                    {tab === 0 && (
                        <motion.div key="catalog" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }} transition={{ duration: .18 }}>
                            {loading ? (
                                <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
                            ) : subjects.length === 0 ? (
                                <Alert severity="info" sx={{ mt: 2 }}>No subjects yet. Click <strong>New Subject</strong> to start!</Alert>
                            ) : (
                                Object.entries(grouped).map(([cat, subs]) => (
                                    <CategorySection key={cat} cat={cat} subjects={subs}
                                        user={user} isOrganization={isOrganization}
                                        selectedId={selectedSubject?._id}
                                        onEdit={handleEdit}
                                        onDelete={handleDeleteSubject}
                                        onSelect={handleSelectSubject}
                                        onRenameCategory={openRename}
                                        onDeleteCategory={openDeleteCat} />
                                ))
                            )}
                        </motion.div>
                    )}

                    {tab === 1 && selectedSubject && (
                        <motion.div key="syllabus" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }} transition={{ duration: .18 }}>
                            <Box display="flex" alignItems="center" gap={1} mb={3}>
                                <Button variant="text" size="small" onClick={() => setTab(0)}>← Back to Catalog</Button>
                                <Typography variant="body2" color="text.secondary">
                                    | Click any card in the Catalog to switch subject
                                </Typography>
                            </Box>
                            <SyllabusPanel subject={selectedSubject} />
                        </motion.div>
                    )}

                    {tab === 2 && selectedSubject && (
                        <motion.div key="graph" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }} transition={{ duration: .18 }} style={{ height: 'calc(100vh - 150px)', width: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                                <Button variant="text" size="small" onClick={() => setTab(0)}>← Back to Catalog</Button>
                                <Typography variant="body2" color="text.secondary">
                                    | Interactive Knowledge Map for {selectedSubject.name}
                                </Typography>
                            </Box>
                            <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                                <GraphExplorer defaultTopic={selectedSubject.name} defaultSubjectId={selectedSubject._id} />
                            </Box>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Box>

            {/* ═══════════ CREATE / EDIT SUBJECT DIALOG ═══════════ */}
            <Dialog open={showCreate} onClose={closeModal} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {isEditing ? 'Edit Subject' : isOrganization && user?.role === 'student' ? 'Suggest a Subject' : 'Create New Subject'}
                </DialogTitle>
                <DialogContent>
                    {!isEditing && (
                        <Tabs value={createMode} onChange={(e, v) => setCreateMode(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                            <Tab label="✍️ Manual" value="manual" />
                            <Tab label="📄 PDF Upload" value="pdf" />
                            <Tab label="📊 PPT Upload" value="ppt" />
                        </Tabs>
                    )}

                    {createMode === 'pdf' ? (
                        <Box sx={{ p: 4, border: '2px dashed', borderColor: 'divider', borderRadius: 2, textAlign: 'center', mt: 2 }}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>Upload Syllabus PDF</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Upload a PDF syllabus document. The AI will extract subject metadata, modules, and topics using a concurrent pipeline.
                            </Typography>
                            <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files[0])} style={{ marginBottom: 16 }} />
                            <br />
                            <Box display="flex" gap={1} justifyContent="center" flexWrap="wrap">
                                <Button variant="contained" disabled={!pdfFile || parsingPdf} onClick={() => handleParsePdf(true)}
                                    sx={{ minWidth: 200 }} color="success">
                                    {parsingPdf ? (
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <CircularProgress size={18} color="inherit" />
                                            <span>Creating subject…</span>
                                        </Box>
                                    ) : '🚀 Quick Create Subject'}
                                </Button>
                                <Button variant="outlined" disabled={!pdfFile || parsingPdf} onClick={() => handleParsePdf(false)}
                                    sx={{ minWidth: 200 }}>
                                    {parsingPdf ? (
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <CircularProgress size={18} color="inherit" />
                                            <span>Extracting…</span>
                                        </Box>
                                    ) : 'Extract & Review First'}
                                </Button>
                            </Box>
                            {pdfMeta && (
                                <Box mt={2} p={1.5} borderRadius={1} sx={{ bgcolor: 'action.hover', textAlign: 'left' }}>
                                    <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                                        📊 Pipeline Summary
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        File: {pdfMeta.filename} &nbsp;|&nbsp;
                                        Modules: {pdfMeta.moduleCount || 0} &nbsp;|&nbsp;
                                        Topics: {pdfMeta.topicCount || 0} &nbsp;|&nbsp;
                                        Strategy: <strong>{pdfMeta.strategy}</strong>
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    ) : createMode === 'ppt' ? (
                        <Box sx={{ p: 4, border: '2px dashed', borderColor: 'divider', borderRadius: 2, textAlign: 'center', mt: 2 }}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>Upload Syllabus PPT</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Upload a PowerPoint (.pptx) file. Slides are parsed, chunked, and sent to the AI for structured module/topic extraction.
                            </Typography>
                            <input type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={e => setPptFile(e.target.files[0])} style={{ marginBottom: 16 }} />
                            <br />
                            <Box display="flex" gap={1} justifyContent="center" flexWrap="wrap">
                                <Button variant="contained" disabled={!pptFile || parsingPpt} onClick={() => handleParsePpt(true)}
                                    sx={{ minWidth: 200 }} color="success">
                                    {parsingPpt ? (
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <CircularProgress size={18} color="inherit" />
                                            <span>Creating subject…</span>
                                        </Box>
                                    ) : '🚀 Quick Create Subject'}
                                </Button>
                                <Button variant="outlined" disabled={!pptFile || parsingPpt} onClick={() => handleParsePpt(false)}
                                    sx={{ minWidth: 200 }}>
                                    {parsingPpt ? (
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <CircularProgress size={18} color="inherit" />
                                            <span>Extracting slides…</span>
                                        </Box>
                                    ) : 'Extract & Review First'}
                                </Button>
                            </Box>
                            {pdfMeta && pdfMeta.fileType === 'pptx' && (
                                <Box mt={2} p={1.5} borderRadius={1} sx={{ bgcolor: 'action.hover', textAlign: 'left' }}>
                                    <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                                        📊 Pipeline Summary
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        File: {pdfMeta.filename} &nbsp;|&nbsp;
                                        Slides: {pdfMeta.totalSlides} &nbsp;|&nbsp;
                                        Text: {pdfMeta.totalTextChars?.toLocaleString()} chars &nbsp;|&nbsp;
                                        Chunks: {pdfMeta.chunksProcessed} &nbsp;|&nbsp;
                                        Strategy: <strong>{pdfMeta.strategy}</strong>
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    ) : (
                        <>
                            <TextField fullWidth label="Subject Name *" margin="normal" required
                                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            <TextField fullWidth label="Domain / Category *" margin="normal" required
                                value={form.domainCategory} onChange={e => setForm({ ...form, domainCategory: e.target.value })}
                                helperText="e.g. Computer Science, Mathematics, Biology" />
                            <TextField fullWidth label="Description / Context" margin="normal" multiline rows={2}
                                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            <TextField fullWidth label="Learning Outcomes (one per line) *" margin="normal" multiline rows={3}
                                value={form.learningOutcomes} onChange={e => setForm({ ...form, learningOutcomes: e.target.value })} />
                        </>
                    )}

                    {user?.role === 'admin' && (
                        <Box mt={1.5}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="checkbox" checked={bypassValidation}
                                    onChange={e => setBypassValidation(e.target.checked)} />
                                <Typography variant="body2">Admin: Bypass AI Validation</Typography>
                            </label>
                        </Box>
                    )}

                    {validationResult && (
                        <Box mt={2} p={2} borderRadius={2}
                            sx={{ bgcolor: validationResult.isValid ? 'success.light' : 'warning.light' }}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                AI Validation {validationResult.isValid ? '✅ Passed' : '⚠️ Review Needed'}
                            </Typography>
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {validationResult.feedback?.map((item, i) => (
                                    <li key={i}><Typography variant="body2">{item}</Typography></li>
                                ))}
                            </ul>
                            {validationResult.suggestedLevel && (
                                <Typography variant="body2" mt={1} color="text.secondary">
                                    Suggested Level: {validationResult.suggestedLevel}
                                </Typography>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeModal} disabled={saving || validating || parsingPdf || parsingPpt}>Cancel</Button>

                    {createMode === 'manual' && (
                        <>
                            {(!validationResult || (!validationResult.isValid && !bypassValidation)) && (
                                <Button variant="outlined" onClick={handleValidate}
                                    disabled={validating || !form.name || !form.domainCategory}>
                                    {validating ? <CircularProgress size={18} /> : 'Validate with AI'}
                                </Button>
                            )}
                            {(validationResult?.isValid || bypassValidation || isEditing) && (
                                <Button variant="contained" onClick={handleSubmit}
                                    disabled={saving || !form.name || !form.domainCategory}>
                                    {saving ? <CircularProgress size={18} color="inherit" /> : isEditing ? 'Save Changes' : 'Publish Subject'}
                                </Button>
                            )}
                        </>
                    )}
                </DialogActions>
            </Dialog>

            {/* ═══════════ RENAME CATEGORY DIALOG ═══════════ */}
            <Dialog open={renameDialog.open} onClose={() => !catBusy && setRenameDialog(d => ({ ...d, open: false }))} maxWidth="xs" fullWidth>
                <DialogTitle>Rename Category</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                        Renaming <strong>"{renameDialog.cat}"</strong> will update all subjects in it.
                    </Typography>
                    <TextField fullWidth label="New Category Name" value={renameDialog.newName} autoFocus
                        onChange={e => setRenameDialog(d => ({ ...d, newName: e.target.value }))} />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setRenameDialog(d => ({ ...d, open: false }))} disabled={catBusy}>Cancel</Button>
                    <Button variant="contained" onClick={doRename}
                        disabled={catBusy || !renameDialog.newName.trim() || renameDialog.newName === renameDialog.cat}>
                        {catBusy ? <CircularProgress size={18} color="inherit" /> : 'Rename'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ═══════════ DELETE CATEGORY DIALOG ═══════════ */}
            <Dialog open={deleteCatDialog.open}
                onClose={() => !catBusy && setDeleteCatDialog(d => ({ ...d, open: false }))} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ color: 'error.main' }}>🗑️ Delete Category</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        <strong>"{deleteCatDialog.cat}"</strong> has {deleteCatDialog.count} subject{deleteCatDialog.count !== 1 ? 's' : ''}.
                        Choose what happens to them:
                    </Alert>
                    <FormControl component="fieldset">
                        <RadioGroup value={deleteCatDialog.mode}
                            onChange={e => setDeleteCatDialog(d => ({ ...d, mode: e.target.value }))}>
                            <FormControlLabel value="delete" control={<Radio color="error" />}
                                label="Delete all subjects in this category" />
                            <FormControlLabel value="reassign" control={<Radio />}
                                label="Move subjects to another category" />
                        </RadioGroup>
                    </FormControl>
                    {deleteCatDialog.mode === 'reassign' && (
                        <TextField fullWidth label="Target Category Name" sx={{ mt: 2 }}
                            value={deleteCatDialog.reassignTo}
                            onChange={e => setDeleteCatDialog(d => ({ ...d, reassignTo: e.target.value }))}
                            helperText="Type an existing or new category name" />
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDeleteCatDialog(d => ({ ...d, open: false }))} disabled={catBusy}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={doDeleteCat}
                        disabled={catBusy || (deleteCatDialog.mode === 'reassign' && !deleteCatDialog.reassignTo.trim())}>
                        {catBusy ? <CircularProgress size={18} color="inherit" /> :
                            deleteCatDialog.mode === 'reassign' ? 'Move & Remove Category' : 'Delete Category & Subjects'}
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
};

export default SubjectCatalog;
