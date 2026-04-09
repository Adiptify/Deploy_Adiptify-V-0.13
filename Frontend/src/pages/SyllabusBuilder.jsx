import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Select, MenuItem, Button, TextField, IconButton, Card, CardContent, CircularProgress } from '@mui/material';
import { Delete, Add, Save } from '@mui/icons-material';
import { apiFetch } from '../api/client';
import { motion } from 'framer-motion';

const SyllabusBuilder = () => {
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState('');
    const [syllabus, setSyllabus] = useState({ modules: [] });
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        apiFetch('/api/subjects').then(setSubjects).catch(console.error);
    }, []);

    useEffect(() => {
        if (selectedSubject) {
            setLoading(true);
            apiFetch(`/api/syllabus/${selectedSubject}`)
                .then(data => {
                    setSyllabus(data?.modules ? data : { modules: [] });
                })
                .catch(() => setSyllabus({ modules: [] }))
                .finally(() => setLoading(false));
        } else {
            setSyllabus({ modules: [] });
        }
    }, [selectedSubject]);

    const handleSave = async () => {
        if (!selectedSubject) return;
        setSaving(true);
        try {
            await apiFetch('/api/syllabus', {
                method: 'POST',
                body: { subjectId: selectedSubject, modules: syllabus.modules }
            });
            alert('Syllabus saved successfully.');
        } catch (e) {
            alert('Failed to save syllabus: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const addModule = () => {
        setSyllabus({ ...syllabus, modules: [...syllabus.modules, { title: '', description: '', topics: [] }] });
    };

    const updateModule = (mIdx, field, value) => {
        const newModules = [...syllabus.modules];
        newModules[mIdx][field] = value;
        setSyllabus({ ...syllabus, modules: newModules });
    };

    const removeModule = (mIdx) => {
        setSyllabus({ ...syllabus, modules: syllabus.modules.filter((_, i) => i !== mIdx) });
    };

    const addTopic = (mIdx) => {
        const newModules = [...syllabus.modules];
        newModules[mIdx].topics.push({ title: '', description: '' });
        setSyllabus({ ...syllabus, modules: newModules });
    };

    const updateTopic = (mIdx, tIdx, field, value) => {
        const newModules = [...syllabus.modules];
        newModules[mIdx].topics[tIdx][field] = value;
        setSyllabus({ ...syllabus, modules: newModules });
    };

    const removeTopic = (mIdx, tIdx) => {
        const newModules = [...syllabus.modules];
        newModules[mIdx].topics = newModules[mIdx].topics.filter((_, i) => i !== tIdx);
        setSyllabus({ ...syllabus, modules: newModules });
    };

    return (
        <Container className="mt-4 pb-12 overflow-y-auto max-h-screen">
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Typography variant="h4" fontWeight="bold" color="primary">
                    Syllabus Builder
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save />}
                    disabled={!selectedSubject || saving || loading}
                    onClick={handleSave}
                >
                    Save Syllabus
                </Button>
            </Box>

            <Card sx={{ mb: 4, p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" mb={1}>Select Subject</Typography>
                <Select
                    fullWidth
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    displayEmpty
                >
                    <MenuItem value="" disabled>-- Select a Subject --</MenuItem>
                    {subjects.map(s => (
                        <MenuItem key={s._id} value={s._id}>{s.name} ({s.domainCategory})</MenuItem>
                    ))}
                </Select>
            </Card>

            {loading ? (
                <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
            ) : selectedSubject && (
                <Box>
                    {syllabus.modules.map((mod, mIdx) => (
                        <motion.div key={mIdx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <Card sx={{ mb: 3, borderLeft: '4px solid #1976d2' }}>
                                <CardContent>
                                    <Box display="flex" justifyContent="space-between" mb={2}>
                                        <Typography variant="h6" fontWeight="bold">Module {mIdx + 1}</Typography>
                                        <IconButton color="error" onClick={() => removeModule(mIdx)}><Delete /></IconButton>
                                    </Box>
                                    <TextField
                                        fullWidth label="Module Title" size="small" sx={{ mb: 2 }}
                                        value={mod.title} onChange={e => updateModule(mIdx, 'title', e.target.value)}
                                    />
                                    <TextField
                                        fullWidth label="Module Description" size="small" multiline rows={2} sx={{ mb: 3 }}
                                        value={mod.description} onChange={e => updateModule(mIdx, 'description', e.target.value)}
                                    />

                                    <Typography variant="subtitle2" fontWeight="bold" color="textSecondary" mb={1} sx={{ pl: 2 }}>
                                        Topics in this Module
                                    </Typography>

                                    <Box pl={2} mb={2}>
                                        {mod.topics.map((topic, tIdx) => (
                                            <Box key={tIdx} display="flex" alignItems="center" gap={2} mb={2} p={2} bgcolor="#f8f9fa" borderRadius={2}>
                                                <Box flex={1}>
                                                    <TextField
                                                        fullWidth label="Topic Title" size="small" sx={{ mb: 1 }}
                                                        value={topic.title} onChange={e => updateTopic(mIdx, tIdx, 'title', e.target.value)}
                                                    />
                                                    <TextField
                                                        fullWidth label="Topic Description" size="small"
                                                        value={topic.description} onChange={e => updateTopic(mIdx, tIdx, 'description', e.target.value)}
                                                    />
                                                </Box>
                                                <IconButton size="small" color="error" onClick={() => removeTopic(mIdx, tIdx)}>
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        ))}
                                        <Button size="small" startIcon={<Add />} onClick={() => addTopic(mIdx)}>
                                            Add Topic
                                        </Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}

                    <Button variant="outlined" startIcon={<Add />} onClick={addModule} fullWidth sx={{ py: 1.5, borderStyle: 'dashed' }}>
                        Add New Module
                    </Button>
                </Box>
            )}
        </Container>
    );
};

export default SyllabusBuilder;
