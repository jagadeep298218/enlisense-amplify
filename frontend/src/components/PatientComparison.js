import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Paper,
    Typography,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    ToggleButton,
    ToggleButtonGroup,
    Alert,
    Grid
} from '@mui/material';
import {
    Compare as CompareIcon,
    Person as PersonIcon
} from '@mui/icons-material';

const PatientComparison = ({ patients }) => {
    const [patient1, setPatient1] = useState('');
    const [patient2, setPatient2] = useState('');
    const [biomarkerType, setBiomarkerType] = useState('glucose');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleCompare = () => {
        if (!patient1 || !patient2) {
            setError('Please select both patients to compare');
            return;
        }

        if (patient1 === patient2) {
            setError('Please select two different patients');
            return;
        }

        setError('');
        navigate(`/agp-comparison/${patient1}/${patient2}/${biomarkerType}`);
    };

    const availablePatients = patients.filter(p => p.username);

    return (
        <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CompareIcon color="primary" />
                Compare AGP Reports
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Select two patients to compare their AGP (Ambulatory Glucose Profile) reports side by side.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Patient 1</InputLabel>
                        <Select
                            value={patient1}
                            label="Patient 1"
                            onChange={(e) => setPatient1(e.target.value)}
                        >
                            {availablePatients.map((patient) => (
                                <MenuItem key={patient.username} value={patient.username}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <PersonIcon fontSize="small" />
                                        {patient.username}
                                        {patient.device_info?.gender && (
                                            <Typography variant="caption" color="text.secondary">
                                                ({patient.device_info.gender}, {patient.device_info.age || 'N/A'})
                                            </Typography>
                                        )}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                <Grid item xs={12} sm={1} sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary">vs</Typography>
                </Grid>

                <Grid item xs={12} sm={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Patient 2</InputLabel>
                        <Select
                            value={patient2}
                            label="Patient 2"
                            onChange={(e) => setPatient2(e.target.value)}
                        >
                            {availablePatients.map((patient) => (
                                <MenuItem key={patient.username} value={patient.username}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <PersonIcon fontSize="small" />
                                        {patient.username}
                                        {patient.device_info?.gender && (
                                            <Typography variant="caption" color="text.secondary">
                                                ({patient.device_info.gender}, {patient.device_info.age || 'N/A'})
                                            </Typography>
                                        )}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                <Grid item xs={12} sm={3}>
                    <ToggleButtonGroup
                        value={biomarkerType}
                        exclusive
                        onChange={(event, newType) => {
                            if (newType) setBiomarkerType(newType);
                        }}
                        size="small"
                        fullWidth
                    >
                        <ToggleButton value="glucose">Glucose</ToggleButton>
                        <ToggleButton value="cortisol">Cortisol</ToggleButton>
                    </ToggleButtonGroup>
                </Grid>

                <Grid item xs={12} sm={2}>
                    <Button
                        onClick={handleCompare}
                        variant="contained"
                        startIcon={<CompareIcon />}
                        disabled={!patient1 || !patient2 || patient1 === patient2}
                        fullWidth
                        size="small"
                    >
                        Compare
                    </Button>
                </Grid>
            </Grid>

            {availablePatients.length < 2 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                    At least 2 patients are required to use the comparison feature.
                </Alert>
            )}
        </Paper>
    );
};

export default PatientComparison; 