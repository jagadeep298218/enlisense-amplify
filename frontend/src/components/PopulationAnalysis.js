import React, { useState, useEffect } from 'react';
import { 
    Container, 
    Typography, 
    Grid, 
    Card, 
    CardContent, 
    Box,
    Alert,
    CircularProgress
} from '@mui/material';

const PopulationAnalysis = () => {
    const [populationData, setPopulationData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchPopulationData();
    }, []);

    const fetchPopulationData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3000/api/population-analysis', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch population data');
            }

            const data = await response.json();
            setPopulationData(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching population data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const PopulationCard = ({ title, data, targetRanges }) => {
        if (!data) return null;

        const { 
            userCount, 
            averageTimeInTarget, 
            averageTimeHigh, 
            averageTimeVeryHigh, 
            averageTimeLow, 
            averageTimeVeryLow 
        } = data;

        // Calculate heights for stacked bar (out of 100%)
        const veryHighHeight = averageTimeVeryHigh || 0;
        const highHeight = averageTimeHigh || 0;
        const targetHeight = averageTimeInTarget || 0;
        const lowHeight = averageTimeLow || 0;
        const veryLowHeight = averageTimeVeryLow || 0;

        return (
            <Card sx={{ height: '100%', border: 2, borderColor: 'primary.main' }}>
                <CardContent>
                    <Typography variant="h6" align="center" fontWeight="bold" gutterBottom>
                        {title}
                    </Typography>
                    <Typography variant="body2" align="center" color="text.secondary" gutterBottom>
                        n = {userCount} users
                    </Typography>

                    {/* Target Goals */}
                    <Box sx={{ mb: 2, textAlign: 'right' }}>
                        <Typography variant="body2" fontWeight="bold">Target</Typography>
                        <Typography variant="body2">&gt;{targetRanges.targetGoal}%</Typography>
                        {targetRanges.highLimit && (
                            <Typography variant="body2">&lt;{targetRanges.highLimit}%</Typography>
                        )}
                        {targetRanges.lowLimit && (
                            <Typography variant="body2">&lt;{targetRanges.lowLimit}%</Typography>
                        )}
                    </Box>

                    {/* Stacked Bar Chart */}
                    <Box sx={{ position: 'relative', height: 300, border: 1, borderColor: 'grey.300' }}>
                        {/* Very High (Red/Orange) */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: `${100 - veryHighHeight}%`,
                                left: 0,
                                right: 0,
                                height: `${veryHighHeight}%`,
                                backgroundColor: '#ff9800',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '12px'
                            }}
                        >
                            {veryHighHeight > 5 && `${veryHighHeight.toFixed(1)}%`}
                        </Box>

                        {/* High (Yellow) */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: `${100 - veryHighHeight - highHeight}%`,
                                left: 0,
                                right: 0,
                                height: `${highHeight}%`,
                                backgroundColor: '#ffeb3b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'black',
                                fontWeight: 'bold',
                                fontSize: '12px'
                            }}
                        >
                            {highHeight > 5 && `${highHeight.toFixed(1)}%`}
                        </Box>

                        {/* Target (Green) */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: `${veryLowHeight + lowHeight}%`,
                                left: 0,
                                right: 0,
                                height: `${targetHeight}%`,
                                backgroundColor: '#4caf50',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '14px'
                            }}
                        >
                            {targetHeight > 5 && `${targetHeight.toFixed(1)}%`}
                        </Box>

                        {/* Low (Light Red) */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: `${veryLowHeight}%`,
                                left: 0,
                                right: 0,
                                height: `${lowHeight}%`,
                                backgroundColor: '#f44336',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '12px'
                            }}
                        >
                            {lowHeight > 5 && `${lowHeight.toFixed(1)}%`}
                        </Box>

                        {/* Very Low (Dark Red) */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: `${veryLowHeight}%`,
                                backgroundColor: '#d32f2f',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '12px'
                            }}
                        >
                            {veryLowHeight > 5 && `${veryLowHeight.toFixed(1)}%`}
                        </Box>
                    </Box>

                    {/* Range Labels */}
                    <Box sx={{ mt: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="caption">&gt;{targetRanges.veryHighMin} mg/dL</Typography>
                            <Typography variant="caption">({(targetRanges.veryHighMin/18).toFixed(1)} mmol/L)</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="caption">&gt;{targetRanges.highMin} mg/dL</Typography>
                            <Typography variant="caption">({(targetRanges.highMin/18).toFixed(1)} mmol/L)</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="caption" fontWeight="bold">
                                Target Range: {targetRanges.targetMin}-{targetRanges.targetMax} mg/dL
                            </Typography>
                            <Typography variant="caption">
                                ({(targetRanges.targetMin/18).toFixed(1)}-{(targetRanges.targetMax/18).toFixed(1)} mmol/L)
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="caption">&lt;{targetRanges.lowMax} mg/dL</Typography>
                            <Typography variant="caption">({(targetRanges.lowMax/18).toFixed(1)} mmol/L)</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption">&lt;{targetRanges.veryLowMax} mg/dL</Typography>
                            <Typography variant="caption">({(targetRanges.veryLowMax/18).toFixed(1)} mmol/L)</Typography>
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        );
    };

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Box display="flex" justifyContent="center">
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Alert severity="error">Error loading population data: {error}</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center" fontWeight="bold">
                Population Analysis Dashboard
            </Typography>
            <Typography variant="subtitle1" align="center" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
                Time in Range Analysis by Population Groups
            </Typography>

            <Grid container spacing={4}>
                {/* General Population */}
                <Grid item xs={12} md={4}>
                    <PopulationCard
                        title="General Population"
                        data={populationData?.general}
                        targetRanges={{
                            targetMin: 70,
                            targetMax: 180,
                            targetGoal: 70,
                            highMin: 180,
                            veryHighMin: 250,
                            lowMax: 70,
                            veryLowMax: 54,
                            highLimit: 25,
                            lowLimit: 4
                        }}
                    />
                </Grid>

                {/* Diabetes Population */}
                <Grid item xs={12} md={4}>
                    <PopulationCard
                        title="Type 1 & Type 2 Diabetes"
                        data={populationData?.diabetes}
                        targetRanges={{
                            targetMin: 70,
                            targetMax: 180,
                            targetGoal: 70,
                            highMin: 180,
                            veryHighMin: 250,
                            lowMax: 70,
                            veryLowMax: 54,
                            highLimit: 25,
                            lowLimit: 4
                        }}
                    />
                </Grid>

                {/* Pregnancy Population */}
                <Grid item xs={12} md={4}>
                    <PopulationCard
                        title="Pregnancy: Type 1 Diabetes"
                        data={populationData?.pregnancy}
                        targetRanges={{
                            targetMin: 63,
                            targetMax: 140,
                            targetGoal: 70,
                            highMin: 140,
                            veryHighMin: 140,
                            lowMax: 63,
                            veryLowMax: 54,
                            highLimit: 25,
                            lowLimit: 4
                        }}
                    />
                </Grid>
            </Grid>

            {/* Summary Statistics */}
            {populationData && (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" gutterBottom>
                        Summary Statistics
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                            <Card>
                                <CardContent>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        Total Users Analyzed
                                    </Typography>
                                    <Typography variant="h4">
                                        {(populationData.general?.userCount || 0) + 
                                         (populationData.diabetes?.userCount || 0) + 
                                         (populationData.pregnancy?.userCount || 0)}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Card>
                                <CardContent>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        Average Time in Target (All Groups)
                                    </Typography>
                                    <Typography variant="h4">
                                        {populationData.overall?.averageTimeInTarget?.toFixed(1) || 'N/A'}%
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Card>
                                <CardContent>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        Data Collection Period
                                    </Typography>
                                    <Typography variant="h6">
                                        {populationData.dateRange || 'N/A'}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Box>
            )}

            {/* Legend */}
            <Box sx={{ mt: 4, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                    Legend:
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 20, height: 20, backgroundColor: '#d32f2f' }}></Box>
                            <Typography variant="caption">Very Low</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 20, height: 20, backgroundColor: '#f44336' }}></Box>
                            <Typography variant="caption">Low</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 20, height: 20, backgroundColor: '#4caf50' }}></Box>
                            <Typography variant="caption">Target Range</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 20, height: 20, backgroundColor: '#ffeb3b' }}></Box>
                            <Typography variant="caption">High</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 20, height: 20, backgroundColor: '#ff9800' }}></Box>
                            <Typography variant="caption">Very High</Typography>
                        </Box>
                    </Grid>
                </Grid>
            </Box>
        </Container>
    );
};

export default PopulationAnalysis; 