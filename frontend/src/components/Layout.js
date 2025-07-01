import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Box,
    Drawer,
    List,
    Typography,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Avatar,
    Chip,
    Menu,
    MenuItem,
    Collapse
} from '@mui/material';
import {
    People as PeopleIcon,
    Analytics as AnalyticsIcon,
    Settings as SettingsIcon,
    AccountBalance as AccountBalanceIcon,
    MedicalServices as MedicalServicesIcon,
    Logout as LogoutIcon,
    ExpandLess,
    ExpandMore,
    UploadFile as UploadFileIcon,
    Compare as CompareIcon
} from '@mui/icons-material';

const drawerWidth = 260;

const Layout = ({ children }) => {
    const [user, setUser] = useState(null);
    const [anchorEl, setAnchorEl] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

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

    // Auto-expand settings if on a settings page
    useEffect(() => {
        if (isSettingsPathActive()) {
            setSettingsOpen(true);
        }
    }, [location.pathname]);

    const handleProfileClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleProfileClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        } catch (error) {
            console.warn('Error clearing localStorage:', error);
        }
        window.location.reload();
    };

    const navigationItems = [
        {
            text: 'Users & Files',
            icon: <PeopleIcon />,
            path: '/',
            roles: ['admin', 'doctor', 'patient']
        },
        {
            text: 'Population Analysis',
            icon: <AnalyticsIcon />,
            path: '/population-analysis',
            roles: ['admin', 'doctor']
        },
        {
            text: 'Compare AGP Reports',
            icon: <CompareIcon />,
            path: '/compare-agp',
            roles: ['admin', 'doctor']
        }
    ];

    const settingsItems = [
        {
            text: 'Upload Personal Info',
            icon: <UploadFileIcon />,
            path: '/settings/upload',
            roles: ['admin', 'doctor', 'patient']
        },
        {
            text: 'Biomarker Config',
            icon: <MedicalServicesIcon />,
            path: '/admin/biomarker-config',
            roles: ['admin']
        },
        {
            text: 'Paid Users',
            icon: <AccountBalanceIcon />,
            path: '/admin/paid-users',
            roles: ['admin']
        },
        {
            text: 'General Settings',
            icon: <SettingsIcon />,
            path: '/settings',
            roles: ['admin', 'doctor', 'patient']
        }
    ];

    const getUserRole = () => {
        if (!user) return 'patient';
        if (user.admin) return 'admin';
        if (user.doctor) return 'doctor';
        return 'patient';
    };

    const isNavItemVisible = (item) => {
        const userRole = getUserRole();
        return item.roles.includes(userRole);
    };

    const handleNavigation = (path) => {
        navigate(path);
    };

    const handleSettingsToggle = () => {
        setSettingsOpen(!settingsOpen);
    };

    const isSettingsPathActive = () => {
        return settingsItems.some(item => 
            item.path === location.pathname || 
            (item.path === '/admin/biomarker-config' && location.pathname === '/admin/biomarker-config') ||
            (item.path === '/admin/paid-users' && location.pathname === '/admin/paid-users') ||
            (item.path === '/settings' && location.pathname === '/settings') ||
            (item.path === '/settings/upload' && location.pathname === '/settings/upload')
        );
    };

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
            {/* Sidebar */}
            <Drawer
                variant="permanent"
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: drawerWidth,
                        boxSizing: 'border-box',
                        bgcolor: 'white',
                        borderRight: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                    },
                }}
            >
                {/* Logo/Brand */}
                <Box sx={{ p: 3, borderBottom: '1px solid #e2e8f0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                bgcolor: '#3b82f6',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '18px'
                            }}
                        >
                            E
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                            EnLiSense
                        </Typography>
                    </Box>
                </Box>

                {/* Navigation */}
                <List sx={{ pt: 2, px: 2 }}>
                    {/* Main Navigation Items */}
                    {navigationItems
                        .filter(isNavItemVisible)
                        .map((item) => (
                            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                                <ListItemButton
                                    onClick={() => handleNavigation(item.path)}
                                    sx={{
                                        borderRadius: '8px',
                                        '&:hover': {
                                            bgcolor: '#f1f5f9',
                                        },
                                        ...(location.pathname === item.path && {
                                            bgcolor: '#eff6ff',
                                            color: '#3b82f6',
                                            '&:hover': {
                                                bgcolor: '#eff6ff',
                                            },
                                        }),
                                    }}
                                >
                                    <ListItemIcon
                                        sx={{
                                            color: location.pathname === item.path ? '#3b82f6' : '#64748b',
                                            minWidth: '40px'
                                        }}
                                    >
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        sx={{
                                            '& .MuiListItemText-primary': {
                                                fontSize: '14px',
                                                fontWeight: location.pathname === item.path ? 600 : 400,
                                                color: location.pathname === item.path ? '#3b82f6' : '#334155'
                                            }
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    
                    {/* Settings Section */}
                    <ListItem disablePadding sx={{ mb: 0.5 }}>
                        <ListItemButton
                            onClick={handleSettingsToggle}
                            sx={{
                                borderRadius: '8px',
                                '&:hover': {
                                    bgcolor: '#f1f5f9',
                                },
                                ...(isSettingsPathActive() && {
                                    bgcolor: '#eff6ff',
                                    color: '#3b82f6',
                                    '&:hover': {
                                        bgcolor: '#eff6ff',
                                    },
                                }),
                            }}
                        >
                            <ListItemIcon
                                sx={{
                                    color: isSettingsPathActive() ? '#3b82f6' : '#64748b',
                                    minWidth: '40px'
                                }}
                            >
                                <SettingsIcon />
                            </ListItemIcon>
                            <ListItemText
                                primary="Settings"
                                sx={{
                                    '& .MuiListItemText-primary': {
                                        fontSize: '14px',
                                        fontWeight: isSettingsPathActive() ? 600 : 400,
                                        color: isSettingsPathActive() ? '#3b82f6' : '#334155'
                                    }
                                }}
                            />
                            {settingsOpen ? <ExpandLess /> : <ExpandMore />}
                        </ListItemButton>
                    </ListItem>

                    {/* Settings Submenu */}
                    <Collapse in={settingsOpen} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                            {settingsItems
                                .filter(isNavItemVisible)
                                .map((item) => (
                                    <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                                        <ListItemButton
                                            onClick={() => handleNavigation(item.path)}
                                            sx={{
                                                borderRadius: '8px',
                                                pl: 4,
                                                '&:hover': {
                                                    bgcolor: '#f1f5f9',
                                                },
                                                ...(location.pathname === item.path && {
                                                    bgcolor: '#eff6ff',
                                                    color: '#3b82f6',
                                                    '&:hover': {
                                                        bgcolor: '#eff6ff',
                                                    },
                                                }),
                                            }}
                                        >
                                            <ListItemIcon
                                                sx={{
                                                    color: location.pathname === item.path ? '#3b82f6' : '#64748b',
                                                    minWidth: '40px'
                                                }}
                                            >
                                                {item.icon}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={item.text}
                                                sx={{
                                                    '& .MuiListItemText-primary': {
                                                        fontSize: '13px',
                                                        fontWeight: location.pathname === item.path ? 600 : 400,
                                                        color: location.pathname === item.path ? '#3b82f6' : '#334155'
                                                    }
                                                }}
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                        </List>
                    </Collapse>
                </List>

                {/* User Profile at Bottom */}
                <Box sx={{ mt: 'auto', p: 2, borderTop: '1px solid #e2e8f0' }}>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            p: 2,
                            borderRadius: '8px',
                            bgcolor: '#f8fafc',
                            cursor: 'pointer',
                            '&:hover': {
                                bgcolor: '#f1f5f9'
                            }
                        }}
                        onClick={handleProfileClick}
                    >
                        <Avatar
                            sx={{
                                width: 36,
                                height: 36,
                                bgcolor: '#3b82f6',
                                fontSize: '14px'
                            }}
                        >
                            {user?.name?.[0]?.toUpperCase() || 'U'}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    color: '#1e293b',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {user?.name || 'User'}
                            </Typography>
                            <Chip
                                label={user?.admin ? 'Admin' : user?.doctor ? 'Doctor' : 'User'}
                                size="small"
                                sx={{
                                    height: '20px',
                                    fontSize: '10px',
                                    bgcolor: user?.admin ? '#fef3c7' : user?.doctor ? '#dbeafe' : '#f3f4f6',
                                    color: user?.admin ? '#92400e' : user?.doctor ? '#1e40af' : '#374151',
                                    '& .MuiChip-label': { px: 1 }
                                }}
                            />
                        </Box>
                    </Box>
                </Box>
            </Drawer>

            {/* Profile Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleProfileClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    Logout
                </MenuItem>
            </Menu>

            {/* Main Content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    bgcolor: '#f8fafc',
                    minHeight: '100vh',
                    overflow: 'auto'
                }}
            >
                {children}
            </Box>
        </Box>
    );
};

export default Layout; 