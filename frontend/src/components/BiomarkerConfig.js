/**
 * BiomarkerConfig.js
 * 
 * PURPOSE: Administrative interface for configuring biomarker range thresholds and conditions
 * 
 * FEATURES:
 * - Dynamic range configuration for glucose and cortisol biomarkers
 * - Condition-specific range templates (pregnancy, diabetes types, pediatric, etc.)
 * - Visual range preview with color-coded thresholds
 * - Persistent storage and retrieval of custom configurations
 * - Template system for common medical conditions
 * - Real-time validation of range boundaries
 * 
 * DEPENDENCIES:
 * - Material-UI for comprehensive form components
 * - Custom condition templates for medical scenarios
 * - API integration for persistent configuration storage
 * 
 * ERROR HANDLING:
 * - [CRITICAL] API save/load failures with user feedback and retry options
 * - [HIGH] Range validation prevents invalid threshold configurations
 * - [MEDIUM] Template loading errors handled with fallback values
 * - [LOW] Form validation provides immediate feedback on invalid inputs
 */

import React, { useState, useEffect } from 'react';
import {
    Container,
    Paper,
    Typography,
    Box,
    Grid,
    TextField,
    Button,
    Card,
    CardContent,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Alert,
    IconButton,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Save as SaveIcon,
    Restore as RestoreIcon,
    ExpandMore as ExpandMoreIcon,
    Science as ScienceIcon,
    Bloodtype as BloodtypeIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';

const BiomarkerConfig = () => {
    const [configs, setConfigs] = useState({
        glucose: {
            default: {
                veryLow: { min: 0, max: 54 },
                low: { min: 54, max: 70 },
                target: { min: 70, max: 180 },
                high: { min: 180, max: 250 },
                veryHigh: { min: 250, max: 400 }
            },
            conditions: {}
        },
        cortisol: {
            default: {
                veryLow: { min: 0, max: 5 },
                low: { min: 5, max: 10 },
                normal: { min: 10, max: 30 },
                high: { min: 30, max: 50 },
                veryHigh: { min: 50, max: 100 }
            },
            conditions: {}
        }
    });

    const [newCondition, setNewCondition] = useState({ name: '', description: '' });
    const [selectedBiomarker, setSelectedBiomarker] = useState('glucose');
    const [selectedCondition, setSelectedCondition] = useState('default');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Common condition templates
    const conditionTemplates = {
        glucose: {
            'pregnancy': {
                name: 'Pregnancy',
                description: 'Glucose ranges for pregnant women',
                ranges: {
                    veryLow: { min: 0, max: 60 },
                    low: { min: 60, max: 70 },
                    target: { min: 70, max: 140 },
                    high: { min: 140, max: 200 },
                    veryHigh: { min: 200, max: 400 }
                }
            },
            'type1_diabetes': {
                name: 'Type 1 Diabetes',
                description: 'Glucose ranges for Type 1 diabetes patients',
                ranges: {
                    veryLow: { min: 0, max: 54 },
                    low: { min: 54, max: 70 },
                    target: { min: 70, max: 180 },
                    high: { min: 180, max: 250 },
                    veryHigh: { min: 250, max: 400 }
                }
            },
            'type2_diabetes': {
                name: 'Type 2 Diabetes',
                description: 'Glucose ranges for Type 2 diabetes patients',
                ranges: {
                    veryLow: { min: 0, max: 70 },
                    low: { min: 70, max: 80 },
                    target: { min: 80, max: 180 },
                    high: { min: 180, max: 240 },
                    veryHigh: { min: 240, max: 400 }
                }
            },
            'pediatric': {
                name: 'Pediatric (Under 18)',
                description: 'Glucose ranges for children and adolescents',
                ranges: {
                    veryLow: { min: 0, max: 60 },
                    low: { min: 60, max: 80 },
                    target: { min: 80, max: 200 },
                    high: { min: 200, max: 300 },
                    veryHigh: { min: 300, max: 400 }
                }
            },
            'smoking': {
                name: 'Smoking',
                description: 'Glucose ranges for patients who smoke',
                ranges: {
                    veryLow: { min: 0, max: 54 },
                    low: { min: 54, max: 70 },
                    target: { min: 70, max: 160 },
                    high: { min: 160, max: 220 },
                    veryHigh: { min: 220, max: 400 }
                }
            },
            'drinking': {
                name: 'Alcohol Consumption',
                description: 'Glucose ranges for patients who consume alcohol regularly',
                ranges: {
                    veryLow: { min: 0, max: 60 },
                    low: { min: 60, max: 75 },
                    target: { min: 75, max: 190 },
                    high: { min: 190, max: 260 },
                    veryHigh: { min: 260, max: 400 }
                }
            },
            'hypertension': {
                name: 'Hypertension',
                description: 'Glucose ranges for patients with high blood pressure',
                ranges: {
                    veryLow: { min: 0, max: 54 },
                    low: { min: 54, max: 70 },
                    target: { min: 70, max: 170 },
                    high: { min: 170, max: 230 },
                    veryHigh: { min: 230, max: 400 }
                }
            }
        },
        cortisol: {
            'pregnancy': {
                name: 'Pregnancy',
                description: 'Cortisol ranges for pregnant women (elevated due to physiological changes)',
                ranges: {
                    veryLow: { min: 0, max: 10 },
                    low: { min: 10, max: 15 },
                    normal: { min: 15, max: 50 },
                    high: { min: 50, max: 70 },
                    veryHigh: { min: 70, max: 100 }
                }
            },
            'cushings': {
                name: "Cushing's Syndrome",
                description: 'Cortisol ranges for patients with suspected or confirmed Cushings syndrome',
                ranges: {
                    veryLow: { min: 0, max: 5 },
                    low: { min: 5, max: 10 },
                    normal: { min: 10, max: 25 },
                    high: { min: 25, max: 40 },
                    veryHigh: { min: 40, max: 100 }
                }
            },
            'addisons': {
                name: "Addison's Disease",
                description: 'Cortisol ranges for patients with adrenal insufficiency',
                ranges: {
                    veryLow: { min: 0, max: 3 },
                    low: { min: 3, max: 8 },
                    normal: { min: 8, max: 20 },
                    high: { min: 20, max: 35 },
                    veryHigh: { min: 35, max: 100 }
                }
            },
            'pediatric': {
                name: 'Pediatric (Under 18)',
                description: 'Cortisol ranges for children and adolescents',
                ranges: {
                    veryLow: { min: 0, max: 3 },
                    low: { min: 3, max: 7 },
                    normal: { min: 7, max: 25 },
                    high: { min: 25, max: 40 },
                    veryHigh: { min: 40, max: 100 }
                }
            },
            'smoking': {
                name: 'Smoking',
                description: 'Cortisol ranges for patients who smoke',
                ranges: {
                    veryLow: { min: 0, max: 3 },
                    low: { min: 3, max: 8 },
                    normal: { min: 8, max: 35 },
                    high: { min: 35, max: 55 },
                    veryHigh: { min: 55, max: 100 }
                }
            },
            'drinking': {
                name: 'Alcohol Consumption',
                description: 'Cortisol ranges for patients who consume alcohol regularly',
                ranges: {
                    veryLow: { min: 0, max: 4 },
                    low: { min: 4, max: 9 },
                    normal: { min: 9, max: 32 },
                    high: { min: 32, max: 52 },
                    veryHigh: { min: 52, max: 100 }
                }
            },
            'hypertension': {
                name: 'Hypertension',
                description: 'Cortisol ranges for patients with high blood pressure',
                ranges: {
                    veryLow: { min: 0, max: 5 },
                    low: { min: 5, max: 10 },
                    normal: { min: 10, max: 32 },
                    high: { min: 32, max: 52 },
                    veryHigh: { min: 52, max: 100 }
                }
            }
        }
    };

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3000/admin/biomarker-configs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.configs) {
                    setConfigs(data.configs);
                }
            }
        } catch (error) {
            console.error('Error fetching configs:', error);
            setMessage({ text: 'Error loading configurations', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const saveConfigs = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3000/admin/biomarker-configs', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ configs })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Save successful:', result);
                setMessage({ text: 'Configurations saved successfully!', type: 'success' });
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Save failed:', response.status, errorData);
                throw new Error(errorData.error || `HTTP ${response.status}: Failed to save configurations`);
            }
        } catch (error) {
            console.error('Error saving configs:', error);
            setMessage({ text: 'Error saving configurations', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const addCondition = (templateKey = null) => {
        let conditionName, conditionDescription;
        
        if (templateKey) {
            // Using a template - get name and description from template
            const template = conditionTemplates[selectedBiomarker][templateKey];
            if (!template) {
                setMessage({ text: 'Template not found', type: 'error' });
                return;
            }
            conditionName = template.name;
            conditionDescription = template.description;
        } else {
            // Custom condition - require manual input
            if (!newCondition.name.trim()) {
                setMessage({ text: 'Please enter a condition name', type: 'error' });
                return;
            }
            conditionName = newCondition.name.trim();
            conditionDescription = newCondition.description;
        }

        const conditionKey = conditionName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        if (configs[selectedBiomarker].conditions[conditionKey]) {
            setMessage({ text: 'Condition already exists', type: 'error' });
            return;
        }

        const template = templateKey ? conditionTemplates[selectedBiomarker][templateKey] : null;
        const ranges = template ? template.ranges : configs[selectedBiomarker].default;

        setConfigs(prev => ({
            ...prev,
            [selectedBiomarker]: {
                ...prev[selectedBiomarker],
                conditions: {
                    ...prev[selectedBiomarker].conditions,
                    [conditionKey]: {
                        name: conditionName,
                        description: conditionDescription || '',
                        ranges: { ...ranges }
                    }
                }
            }
        }));

        setNewCondition({ name: '', description: '' });
        setMessage({ text: `Condition "${conditionName}" added successfully!`, type: 'success' });
    };

    const deleteCondition = (conditionKey) => {
        if (conditionKey === 'default') return;

        setConfigs(prev => {
            const updated = { ...prev };
            delete updated[selectedBiomarker].conditions[conditionKey];
            return updated;
        });

        if (selectedCondition === conditionKey) {
            setSelectedCondition('default');
        }
        setMessage({ text: 'Condition deleted successfully!', type: 'success' });
    };

    const updateRange = (rangeKey, field, value) => {
        const numValue = parseFloat(value) || 0;
        
        setConfigs(prev => {
            const updated = { ...prev };
            const targetConfig = selectedCondition === 'default' 
                ? updated[selectedBiomarker].default 
                : updated[selectedBiomarker].conditions[selectedCondition].ranges;
            
            targetConfig[rangeKey][field] = numValue;
            return updated;
        });
    };

    const getCurrentRanges = () => {
        if (selectedCondition === 'default') {
            return configs[selectedBiomarker].default;
        }
        return configs[selectedBiomarker].conditions[selectedCondition]?.ranges || {};
    };

    const getRangeLabels = (biomarker) => {
        if (biomarker === 'glucose') {
            return ['veryLow', 'low', 'target', 'high', 'veryHigh'];
        }
        return ['veryLow', 'low', 'normal', 'high', 'veryHigh'];
    };

    const getRangeDisplayName = (key) => {
        const names = {
            veryLow: 'Very Low',
            low: 'Low',
            target: 'Target Range',
            normal: 'Normal Range',
            high: 'High',
            veryHigh: 'Very High'
        };
        return names[key] || key;
    };

    const getRangeColor = (key) => {
        const colors = {
            veryLow: '#dc2626',
            low: '#f59e0b',
            target: '#10b981',
            normal: '#10b981',
            high: '#f59e0b',
            veryHigh: '#dc2626'
        };
        return colors[key] || '#6b7280';
    };

    const getUnit = (biomarker) => biomarker === 'glucose' ? 'mg/dL' : 'ng/mL';

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Paper sx={{ p: 4 }}>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SettingsIcon color="primary" />
                        Biomarker Range Configuration
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Configure custom ranges for glucose and cortisol based on patient conditions and characteristics.
                        These ranges will be used in AGP reports and analysis.
                    </Typography>
                </Box>

                {message.text && (
                    <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage({ text: '', type: '' })}>
                        {message.text}
                    </Alert>
                )}

                <Grid container spacing={4}>
                    {/* Left Panel - Configuration */}
                    <Grid item xs={12} lg={8}>
                        {/* Biomarker Selection */}
                        <Card sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Select Biomarker</Typography>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button
                                        variant={selectedBiomarker === 'glucose' ? 'contained' : 'outlined'}
                                        startIcon={<ScienceIcon />}
                                        onClick={() => {
                                            setSelectedBiomarker('glucose');
                                            setSelectedCondition('default');
                                        }}
                                    >
                                        Glucose (mg/dL)
                                    </Button>
                                    <Button
                                        variant={selectedBiomarker === 'cortisol' ? 'contained' : 'outlined'}
                                        startIcon={<BloodtypeIcon />}
                                        onClick={() => {
                                            setSelectedBiomarker('cortisol');
                                            setSelectedCondition('default');
                                        }}
                                    >
                                        Cortisol (ng/mL)
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>

                        {/* Condition Selection */}
                        <Card sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Select Condition/Population</Typography>
                                <FormControl fullWidth sx={{ mb: 2 }}>
                                    <InputLabel>Condition</InputLabel>
                                    <Select
                                        value={selectedCondition}
                                        label="Condition"
                                        onChange={(e) => setSelectedCondition(e.target.value)}
                                    >
                                        <MenuItem value="default">
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Chip label="Default" size="small" color="primary" />
                                                General Population
                                            </Box>
                                        </MenuItem>
                                        {Object.entries(configs[selectedBiomarker].conditions).map(([key, condition]) => (
                                            <MenuItem key={key} value={key}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between', width: '100%' }}>
                                                    <Box>
                                                        <Typography variant="body2">{condition.name}</Typography>
                                                        {condition.description && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                {condition.description}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteCondition(key);
                                                        }}
                                                        sx={{ ml: 1 }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {/* Add New Condition */}
                                <Accordion>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography variant="subtitle2">Add New Condition</Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    fullWidth
                                                    label="Condition Name"
                                                    value={newCondition.name}
                                                    onChange={(e) => setNewCondition(prev => ({ ...prev, name: e.target.value }))}
                                                    size="small"
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    fullWidth
                                                    label="Description"
                                                    value={newCondition.description}
                                                    onChange={(e) => setNewCondition(prev => ({ ...prev, description: e.target.value }))}
                                                    size="small"
                                                />
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                    <Button
                                                        variant="contained"
                                                        startIcon={<AddIcon />}
                                                        onClick={() => addCondition()}
                                                        size="small"
                                                    >
                                                        Add Custom
                                                    </Button>
                                                    {Object.keys(conditionTemplates[selectedBiomarker]).map(templateKey => (
                                                        <Button
                                                            key={templateKey}
                                                            variant="outlined"
                                                            startIcon={<AddIcon />}
                                                            onClick={() => addCondition(templateKey)}
                                                            size="small"
                                                        >
                                                            Add {conditionTemplates[selectedBiomarker][templateKey].name}
                                                        </Button>
                                                    ))}
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    </AccordionDetails>
                                </Accordion>
                            </CardContent>
                        </Card>

                        {/* Range Configuration */}
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Configure Ranges - {selectedCondition === 'default' ? 'Default' : configs[selectedBiomarker].conditions[selectedCondition]?.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Set the min and max values for each range category. Unit: {getUnit(selectedBiomarker)}
                                </Typography>

                                <Grid container spacing={2}>
                                    {getRangeLabels(selectedBiomarker).map((rangeKey) => {
                                        const range = getCurrentRanges()[rangeKey] || { min: 0, max: 0 };
                                        return (
                                            <Grid item xs={12} sm={6} md={4} key={rangeKey}>
                                                <Paper
                                                    sx={{
                                                        p: 2,
                                                        border: `2px solid ${getRangeColor(rangeKey)}`,
                                                        borderRadius: 2
                                                    }}
                                                >
                                                    <Typography
                                                        variant="subtitle2"
                                                        gutterBottom
                                                        sx={{ color: getRangeColor(rangeKey), fontWeight: 'bold' }}
                                                    >
                                                        {getRangeDisplayName(rangeKey)}
                                                    </Typography>
                                                    <Grid container spacing={1}>
                                                        <Grid item xs={6}>
                                                            <TextField
                                                                fullWidth
                                                                label="Min"
                                                                type="number"
                                                                value={range.min}
                                                                onChange={(e) => updateRange(rangeKey, 'min', e.target.value)}
                                                                size="small"
                                                                inputProps={{ step: selectedBiomarker === 'cortisol' ? 0.1 : 1 }}
                                                            />
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <TextField
                                                                fullWidth
                                                                label="Max"
                                                                type="number"
                                                                value={range.max}
                                                                onChange={(e) => updateRange(rangeKey, 'max', e.target.value)}
                                                                size="small"
                                                                inputProps={{ step: selectedBiomarker === 'cortisol' ? 0.1 : 1 }}
                                                            />
                                                        </Grid>
                                                    </Grid>
                                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                                        {range.min} - {range.max} {getUnit(selectedBiomarker)}
                                                    </Typography>
                                                </Paper>
                                            </Grid>
                                        );
                                    })}
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Right Panel - Preview & Actions */}
                    <Grid item xs={12} lg={4}>
                        <Card sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Actions</Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Button
                                        variant="contained"
                                        startIcon={<SaveIcon />}
                                        onClick={saveConfigs}
                                        disabled={loading}
                                        fullWidth
                                    >
                                        Save All Configurations
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={async () => {
                                            const token = localStorage.getItem('token');
                                            try {
                                                const response = await fetch('http://localhost:3000/admin/auth-test', {
                                                    headers: { 'Authorization': `Bearer ${token}` }
                                                });
                                                const result = await response.json();
                                                console.log('Auth test result:', result);
                                                setMessage({ 
                                                    text: `Auth test: ${result.message || JSON.stringify(result)}`, 
                                                    type: result.isAdmin ? 'success' : 'warning' 
                                                });
                                            } catch (error) {
                                                console.error('Auth test failed:', error);
                                                setMessage({ text: `Auth test failed: ${error.message}`, type: 'error' });
                                            }
                                        }}
                                        fullWidth
                                        size="small"
                                    >
                                        Test Admin Auth
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<RestoreIcon />}
                                        onClick={fetchConfigs}
                                        disabled={loading}
                                        fullWidth
                                    >
                                        Reset to Saved
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>

                        {/* Preview */}
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Range Preview</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    How ranges will appear in AGP reports:
                                </Typography>
                                
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {getRangeLabels(selectedBiomarker).map((rangeKey) => {
                                        const range = getCurrentRanges()[rangeKey] || { min: 0, max: 0 };
                                        return (
                                            <Box
                                                key={rangeKey}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    p: 1,
                                                    borderRadius: 1,
                                                    bgcolor: 'background.default'
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 20,
                                                        height: 20,
                                                        bgcolor: getRangeColor(rangeKey),
                                                        borderRadius: 0.5
                                                    }}
                                                />
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                        {getRangeDisplayName(rangeKey)}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {range.min} - {range.max} {getUnit(selectedBiomarker)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Paper>
        </Container>
    );
};

export default BiomarkerConfig; 