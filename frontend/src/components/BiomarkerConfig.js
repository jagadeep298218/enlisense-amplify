/**
 * BiomarkerConfig.js
 * 
 * PURPOSE: Administrative interface for viewing biomarker range thresholds and conditions
 * 
 * FEATURES:
 * - Read-only display of biomarker ranges from MongoDB csv2ranges collection
 * - Condition-specific range viewing for glucose and cortisol biomarkers
 * - Visual range preview with color-coded thresholds
 * - Automatic refresh from database
 * 
 * DEPENDENCIES:
 * - Material-UI for comprehensive display components
 * - API integration for fetching ranges from csv2ranges collection
 * 
 * ERROR HANDLING:
 * - [CRITICAL] API load failures with user feedback and retry options
 * - [MEDIUM] Database connection errors handled with fallback values
 * - [LOW] Display validation provides feedback on missing data
 */

import React, { useState, useEffect } from 'react';
import config from '../config';
import {
    Container,
    Paper,
    Typography,
    Box,
    Grid,
    Button,
    Card,
    CardContent,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Alert,
    CircularProgress
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Science as ScienceIcon,
    Bloodtype as BloodtypeIcon,
    Visibility as VisibilityIcon
} from '@mui/icons-material';

const BiomarkerConfig = () => {
    const [configs, setConfigs] = useState({
        glucose: {
            default: {},
            conditions: {}
        },
        cortisol: {
            default: {},
            conditions: {}
        }
    });

    const [selectedBiomarker, setSelectedBiomarker] = useState('glucose');
    const [selectedCondition, setSelectedCondition] = useState('default');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${config.API_URL}/admin/biomarker-configs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.configs) {
                    setConfigs(data.configs);
                    setMessage({ text: 'Biomarker ranges loaded from database successfully!', type: 'success' });
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                setMessage({ 
                    text: errorData.message || 'Error loading configurations from database', 
                    type: 'error' 
                });
            }
        } catch (error) {
            console.error('Error fetching configs:', error);
            setMessage({ text: 'Error connecting to database', type: 'error' });
        } finally {
            setLoading(false);
        }
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

    const hasRangeData = () => {
        const ranges = getCurrentRanges();
        return Object.keys(ranges).length > 0;
    };

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Paper sx={{ p: 4 }}>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <VisibilityIcon color="primary" />
                        Biomarker Range Configuration (Read-Only)
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        View biomarker ranges for glucose and cortisol as configured in the database. 
                        These ranges are automatically sourced from the s3-mongodb-csv2ranges collection 
                        and are used in AGP reports and analysis.
                    </Typography>
                    <Alert severity="info" sx={{ mt: 2 }}>
                        <strong>Note:</strong> Ranges are read-only and automatically sourced from the database. 
                        To modify ranges, please update the s3-mongodb-csv2ranges collection directly.
                    </Alert>
                </Box>

                {message.text && (
                    <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage({ text: '', type: '' })}>
                        {message.text}
                    </Alert>
                )}

                <Grid container spacing={4}>
                    {/* Left Panel - Configuration Display */}
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
                                                <Box>
                                                    <Typography variant="body2">{condition.name}</Typography>
                                                    {condition.description && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {condition.description}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                {Object.keys(configs[selectedBiomarker].conditions).length === 0 && (
                                    <Typography variant="body2" color="text.secondary">
                                        No specific conditions configured for {selectedBiomarker} in the database.
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>

                        {/* Range Display */}
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Current Ranges - {selectedCondition === 'default' ? 'Default' : configs[selectedBiomarker].conditions[selectedCondition]?.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Ranges sourced from database. Unit: {getUnit(selectedBiomarker)}
                                </Typography>

                                {hasRangeData() ? (
                                    <Grid container spacing={2}>
                                        {getRangeLabels(selectedBiomarker).map((rangeKey) => {
                                            const range = getCurrentRanges()[rangeKey] || { min: 0, max: 0 };
                                            return (
                                                <Grid item xs={12} sm={6} md={4} key={rangeKey}>
                                                    <Paper
                                                        sx={{
                                                            p: 2,
                                                            border: `2px solid ${getRangeColor(rangeKey)}`,
                                                            borderRadius: 2,
                                                            bgcolor: 'grey.50'
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="subtitle2"
                                                            gutterBottom
                                                            sx={{ color: getRangeColor(rangeKey), fontWeight: 'bold' }}
                                                        >
                                                            {getRangeDisplayName(rangeKey)}
                                                        </Typography>
                                                        <Box sx={{ 
                                                            display: 'flex', 
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            bgcolor: 'white',
                                                            p: 1,
                                                            borderRadius: 1,
                                                            border: '1px solid',
                                                            borderColor: 'grey.300'
                                                        }}>
                                                            <Box sx={{ textAlign: 'center' }}>
                                                                <Typography variant="body2" color="text.secondary">Min</Typography>
                                                                <Typography variant="h6">{range.min}</Typography>
                                                            </Box>
                                                            <Typography variant="body2" color="text.secondary">-</Typography>
                                                            <Box sx={{ textAlign: 'center' }}>
                                                                <Typography variant="body2" color="text.secondary">Max</Typography>
                                                                <Typography variant="h6">{range.max}</Typography>
                                                            </Box>
                                                        </Box>
                                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                                                            {range.min} - {range.max} {getUnit(selectedBiomarker)}
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                            );
                                        })}
                                    </Grid>
                                ) : (
                                    <Alert severity="warning">
                                        No range data found in database for {selectedBiomarker} - {selectedCondition}
                                    </Alert>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Right Panel - Actions & Preview */}
                    <Grid item xs={12} lg={4}>
                        <Card sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Actions</Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Button
                                        variant="contained"
                                        startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
                                        onClick={fetchConfigs}
                                        disabled={loading}
                                        fullWidth
                                    >
                                        {loading ? 'Loading...' : 'Refresh from Database'}
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>

                        {/* Preview */}
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Range Preview</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    How ranges appear in AGP reports:
                                </Typography>
                                
                                {hasRangeData() ? (
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
                                ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                        No range data available for preview
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Paper>
        </Container>
    );
};

export default BiomarkerConfig; 