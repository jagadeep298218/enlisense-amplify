import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Typography,
    Card,
    CardContent,
    Avatar,
    Chip,
    Container,
    Paper
} from '@mui/material';
import {
    Favorite as HeartIcon,
    Opacity as BloodPressureIcon,
    LocalDining as GlucoseIcon,
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    MedicalServices as MedicalIcon,
    Healing as HealingIcon,
    Dashboard as DashboardIcon
} from '@mui/icons-material';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';

const Dashboard = () => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
        } catch (error) {
            console.warn('Failed to parse stored user data:', error);
        }
    }, []);

    // Sample data for the activity chart
    const activityData = [
        { day: 'Mon', glucose: 85, heartRate: 72 },
        { day: 'Tue', glucose: 92, heartRate: 75 },
        { day: 'Wed', glucose: 78, heartRate: 69 },
        { day: 'Thu', glucose: 95, heartRate: 78 },
        { day: 'Fri', glucose: 88, heartRate: 73 },
        { day: 'Sat', glucose: 82, heartRate: 70 },
        { day: 'Sun', glucose: 90, heartRate: 74 }
    ];

    const MetricCard = ({ title, value, unit, icon, color, trend }) => (
        <Card
            sx={{
                height: '140px',
                background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
                border: `1px solid ${color}20`,
                borderRadius: '16px',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
                    transition: 'all 0.3s ease'
                }
            }}
        >
            <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '12px',
                            bgcolor: `${color}20`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: color
                        }}
                    >
                        {icon}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', color: trend > 0 ? '#10b981' : '#ef4444' }}>
                        {trend > 0 ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
                        <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 600 }}>
                            {Math.abs(trend)}%
                        </Typography>
                    </Box>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                    {value}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                    {title}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', mt: 'auto' }}>
                    {unit}
                </Typography>
            </CardContent>
        </Card>
    );

    const Calendar = () => {
        const today = new Date();
        const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
        
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const calendarDays = [];

        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarDays.push(null);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            calendarDays.push(day);
        }

        return (
            <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
                        {currentMonth}
                    </Typography>
                    
                    <Grid container spacing={1} sx={{ mb: 1 }}>
                        {days.map((day) => (
                            <Grid item xs={12/7} key={day}>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        display: 'block',
                                        textAlign: 'center',
                                        fontWeight: 600,
                                        color: '#64748b',
                                        p: 1
                                    }}
                                >
                                    {day}
                                </Typography>
                            </Grid>
                        ))}
                    </Grid>

                    <Grid container spacing={1}>
                        {calendarDays.map((day, index) => (
                            <Grid item xs={12/7} key={index}>
                                <Box
                                    sx={{
                                        height: 32,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '8px',
                                        cursor: day ? 'pointer' : 'default',
                                        bgcolor: day === today.getDate() ? '#3b82f6' : 'transparent',
                                        color: day === today.getDate() ? 'white' : '#334155',
                                        '&:hover': day ? {
                                            bgcolor: day === today.getDate() ? '#3b82f6' : '#f1f5f9'
                                        } : {}
                                    }}
                                >
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {day}
                                    </Typography>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                </CardContent>
            </Card>
        );
    };

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Page Header */}
            <Paper sx={{ p: 4, mb: 4, bgcolor: 'primary.main', color: 'white' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <DashboardIcon sx={{ fontSize: 40 }} />
                    <Box>
                        <Typography variant="h4" fontWeight="bold">
                            Dashboard
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.9, mt: 1 }}>
                            Welcome back! Here's what's happening with your health data.
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            <Grid container spacing={3}>
                <Grid item xs={12} lg={8}>
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                        <Grid item xs={12} md={4}>
                            <MetricCard
                                title="Heart Rate"
                                value={72}
                                unit="BPM"
                                icon={<HeartIcon />}
                                color="#ef4444"
                                trend={5}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <MetricCard
                                title="Blood Pressure"
                                value="120/80"
                                unit="mmHg"
                                icon={<BloodPressureIcon />}
                                color="#06b6d4"
                                trend={-2}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <MetricCard
                                title="Glucose Level"
                                value={95}
                                unit="mg/dL"
                                icon={<GlucoseIcon />}
                                color="#8b5cf6"
                                trend={3}
                            />
                        </Grid>
                    </Grid>

                    <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', height: '400px', mb: 3 }}>
                        <CardContent sx={{ p: 3, height: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                    Activity
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Chip label="Weekly" size="small" color="primary" />
                                    <Chip label="Monthly" size="small" variant="outlined" />
                                </Box>
                            </Box>
                            <ResponsiveContainer width="100%" height="85%">
                                <AreaChart data={activityData}>
                                    <defs>
                                        <linearGradient id="glucoseGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="heartRateGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis 
                                        dataKey="day" 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                    />
                                    <Tooltip 
                                        contentStyle={{
                                            backgroundColor: 'white',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="glucose"
                                        stroke="#3b82f6"
                                        strokeWidth={3}
                                        fill="url(#glucoseGradient)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 2 }}>
                                        Recommendation
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: '#fef3c7', borderRadius: '8px' }}>
                                        <Box
                                            sx={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: '8px',
                                                bgcolor: '#f59e0b',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white'
                                            }}
                                        >
                                            <MedicalIcon />
                                        </Box>
                                        <Typography variant="body2" sx={{ color: '#92400e', fontWeight: 500 }}>
                                            What is Arteriosclerosis and How to prevent it
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 2 }}>
                                        Treatment
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: '#f3e8ff', borderRadius: '8px' }}>
                                        <Box
                                            sx={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: '8px',
                                                bgcolor: '#8b5cf6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white'
                                            }}
                                        >
                                            <HealingIcon />
                                        </Box>
                                        <Typography variant="body2" sx={{ color: '#7c3aed', fontWeight: 500 }}>
                                            Vitamin A
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Grid>

                <Grid item xs={12} lg={4}>
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Calendar />
                        </Grid>
                        <Grid item xs={12}>
                            <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                            Doctors
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#3b82f6', cursor: 'pointer' }}>
                                            See all 6
                                        </Typography>
                                    </Box>
                                    
                                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                        {['Dr. Smith', 'Dr. Johnson', 'Dr. Chen', 'Dr. Davis'].map((doctor, index) => (
                                            <Avatar
                                                key={doctor}
                                                sx={{
                                                    width: 48,
                                                    height: 48,
                                                    bgcolor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index],
                                                    cursor: 'pointer',
                                                    '&:hover': {
                                                        transform: 'scale(1.1)',
                                                        transition: 'transform 0.2s ease'
                                                    }
                                                }}
                                            >
                                                {doctor.split(' ')[1][0]}
                                            </Avatar>
                                        ))}
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12}>
                            <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
                                        Details
                                    </Typography>
                                    
                                    <Grid container spacing={3}>
                                        <Grid item xs={4}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                                    A+
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                                    Blood
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={4}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                                    170 CM
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                                    Height
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={4}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                                    70 KG
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                                    Weight
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
        </Container>
    );
};

export default Dashboard; 