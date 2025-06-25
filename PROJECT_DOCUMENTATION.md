# EnLiSense Dashboard - Project Documentation

## 📋 Project Overview

The EnLiSense Dashboard is a comprehensive biomarker analysis platform designed for continuous glucose and cortisol monitoring. It provides healthcare professionals and patients with detailed ambulatory glucose/cortisol profiles (AGP/ACP), statistical analysis, and customizable reporting features.

## 🏗️ System Architecture

```
dashboard-enlisense-actual/
├── frontend/                 # React.js frontend application
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── App.js           # Main application router
│   │   ├── index.js         # React entry point
│   │   └── assets/          # Static assets
│   └── package.json         # Frontend dependencies
├── backend/                 # Node.js/Express backend
│   ├── server.js           # Main server file
│   ├── uploads/            # File upload storage
│   └── package.json        # Backend dependencies
└── PROJECT_DOCUMENTATION.md # This file
```

## 🔧 Technology Stack

### Frontend
- **React 19.1.0** - Component-based UI framework
- **Material-UI (MUI)** - Modern component library
- **React Router** - Client-side routing
- **Plotly.js** - Interactive data visualization
- **html2canvas + jsPDF** - PDF report generation

### Backend
- **Node.js + Express** - Web server framework
- **MongoDB** - NoSQL database
- **JWT** - Authentication tokens
- **Multer** - File upload handling
- **CSV Parser** - Data processing

## 📁 File Structure & Purposes

### Frontend Components

#### Core Application Files

**`src/App.js`** - Main Application Router
- **Purpose**: Root component managing authentication and routing
- **Features**: Protected routes, authentication state, navigation
- **Key Functions**:
  - `handleLoginSuccess()` - Updates auth state after login
  - Authentication token validation from localStorage
- **Error Prone Areas**:
  - [CRITICAL] Token expiration not handled
  - [WARNING] No error boundary for component crashes
  - [WARNING] localStorage access without try-catch

**`src/index.js`** - React Entry Point
- **Purpose**: Mounts React application to DOM
- **Dependencies**: React, ReactDOM, App component

#### Authentication Components

**`src/components/Login.js`** - User Authentication
- **Purpose**: Handles user login with JWT token management
- **Features**: Form validation, token storage, error handling
- **API Endpoints**: `POST /login`
- **Error Prone Areas**:
  - [HIGH] Network failures during login
  - [MEDIUM] Invalid credentials handling
  - [LOW] Form validation edge cases

#### Data Management Components

**`src/components/FileTracker.js`** - Main Dashboard
- **Purpose**: Central dashboard for uploaded files and patient data
- **Features**: Data grid, file management, user navigation
- **Subcomponents**: CSVUpload, PatientComparison
- **API Endpoints**: `GET /filetracker`, `GET /filetracker/download-csv`
- **Error Prone Areas**:
  - [CRITICAL] Large datasets may cause performance issues
  - [HIGH] File upload failures not properly handled
  - [MEDIUM] Grid pagination with large data sets

**`src/components/CSVUpload.js`** - File Upload Interface
- **Purpose**: Handles CSV file uploads with validation
- **Features**: Drag-and-drop, file validation, progress tracking
- **API Endpoints**: `POST /upload`
- **Error Prone Areas**:
  - [CRITICAL] Large file uploads may timeout
  - [HIGH] Invalid CSV format crashes parser
  - [MEDIUM] Network interruptions during upload

#### Report & Analysis Components

**`src/components/AGPReport.js`** - Ambulatory Profile Reports
- **Purpose**: Generate comprehensive biomarker analysis reports
- **Features**: 
  - Interactive AGP/ACP charts with percentile analysis
  - Time-in-range visualizations
  - PDF/CSV export functionality
  - Custom range configurations
  - Biomarker switching (glucose/cortisol)
- **Key Functions**:
  - `downloadPDF()` - Generate PDF reports using html2canvas
  - `downloadCSV()` - Export additional metrics to CSV
  - `fetchAGPData()` - Parallel API calls for data and ranges
- **API Endpoints**: 
  - `GET /user-glucose-agp/:username`
  - `GET /user-cortisol-agp/:username`
  - `GET /user-applicable-ranges/:username/:biomarkerType`
- **Error Prone Areas**:
  - [CRITICAL] PDF generation may fail on complex DOM structures
  - [HIGH] Large datasets exceed memory limits during processing
  - [MEDIUM] Date parsing errors crash component
  - [LOW] Missing statistics cause undefined value displays

**`src/components/AGPComparison.js`** - Comparative Analysis
- **Purpose**: Side-by-side comparison of patient biomarker profiles
- **Features**: Dual chart displays, statistical comparisons
- **Error Prone Areas**:
  - [HIGH] Mismatched data ranges between patients
  - [MEDIUM] Performance issues with dual chart rendering

**`src/components/UserVersions.js`** - Patient Data History
- **Purpose**: Display historical versions of patient data
- **Features**: Version timeline, data comparison, version management
- **Error Prone Areas**:
  - [HIGH] Version conflicts during concurrent edits
  - [MEDIUM] Large version histories slow loading

**`src/components/PopulationAnalysis.js`** - Population-Level Analytics
- **Purpose**: Aggregate analysis across multiple patients
- **Features**: Population statistics, trend analysis, cohort comparisons
- **Error Prone Areas**:
  - [CRITICAL] Large population datasets cause memory issues
  - [HIGH] Privacy concerns with aggregated data

**`src/components/BiomarkerConfig.js`** - Admin Configuration
- **Purpose**: Administrative interface for biomarker range settings
- **Features**: Custom range definitions, configuration management
- **Error Prone Areas**:
  - [HIGH] Invalid range configurations break analysis
  - [MEDIUM] Permission checks for admin access

**`src/components/PatientComparison.js`** - Patient Selection Interface
- **Purpose**: Interface for selecting patients for comparison
- **Features**: Patient search, selection validation

### Backend Structure

**`server.js`** - Main Server Application
- **Purpose**: Express server with API routes and middleware
- **Features**: 
  - Authentication middleware
  - File upload handling
  - Database connections
  - CORS configuration
- **Key Endpoints**:
  - `POST /login` - User authentication
  - `GET /filetracker` - Patient data listing
  - `POST /upload` - File upload processing
  - `GET /user-*-agp/:username` - AGP data retrieval
- **Error Prone Areas**:
  - [CRITICAL] Database connection failures
  - [HIGH] File upload storage limits
  - [MEDIUM] Authentication token validation

## 🚨 Critical Error Handling Areas

### High Priority Fixes Needed

1. **Authentication Token Expiration**
   - **Issue**: Expired tokens cause silent failures
   - **Fix**: Implement automatic logout on 401 responses
   - **Files**: `App.js`, all API calling components

2. **PDF Generation Reliability**
   - **Issue**: html2canvas fails on complex DOM structures
   - **Fix**: Add canvas validation and retry mechanisms
   - **Files**: `AGPReport.js`

3. **Large Dataset Performance**
   - **Issue**: Memory issues with large patient datasets
   - **Fix**: Implement pagination and data chunking
   - **Files**: `FileTracker.js`, `PopulationAnalysis.js`

4. **Network Failure Handling**
   - **Issue**: No retry mechanisms for failed API calls
   - **Fix**: Add exponential backoff retry logic
   - **Files**: All components making API calls

### Medium Priority Improvements

1. **Error Boundaries**
   - **Issue**: Component crashes break entire application
   - **Fix**: Implement React Error Boundaries
   - **Files**: `App.js`

2. **Date Parsing Validation**
   - **Issue**: Invalid dates crash components
   - **Fix**: Add date validation with fallbacks
   - **Files**: `AGPReport.js`, `UserVersions.js`

3. **Form Validation Enhancement**
   - **Issue**: Inconsistent validation across forms
   - **Fix**: Centralized validation library
   - **Files**: `Login.js`, `CSVUpload.js`, `BiomarkerConfig.js`

## 🚀 Performance Optimizations Implemented

### Memoization
- **useMemo**: Complex calculations in `AGPReport.js` for chart configurations
- **useCallback**: Event handlers and utility functions to prevent re-renders

### Code Splitting
- Components are dynamically imported in route definitions
- Reduces initial bundle size

### API Optimization
- Parallel API calls using `Promise.all` in data fetching
- Request timeout protection to prevent hanging

### Memory Management
- Proper cleanup of event listeners and timeouts
- URL.revokeObjectURL() for blob cleanup after downloads

## 🔒 Security Considerations

### Authentication
- JWT tokens stored in localStorage (consider httpOnly cookies)
- Token validation on protected routes
- Admin role verification for configuration access

### Data Privacy
- Patient data anonymization in logs
- Secure file upload validation
- CORS configuration for API access

### Input Validation
- CSV file format validation
- SQL injection prevention (using parameterized queries)
- XSS protection in data display

## 📊 API Documentation

### Authentication Endpoints
- `POST /login` - User authentication with username/password
- Returns JWT token for subsequent requests

### Data Management Endpoints
- `GET /filetracker` - List all patient files with metadata
- `POST /upload` - Upload CSV files with patient data
- `GET /filetracker/download-csv` - Export file tracker data

### AGP Report Endpoints
- `GET /user-glucose-agp/:username` - Glucose AGP data
- `GET /user-cortisol-agp/:username` - Cortisol AGP data
- `GET /user-applicable-ranges/:username/:biomarkerType` - Custom ranges

## 🛠️ Development Guidelines

### Component Structure
1. File header documentation with purpose and dependencies
2. Function documentation with parameters and error handling
3. Error-prone area identification with severity levels
4. Performance optimization notes

### Error Handling Standards
- Try-catch blocks around all API calls
- User-friendly error messages
- Fallback UI states for failed operations
- Logging for debugging purposes

### Performance Best Practices
- Use React.memo for expensive components
- Implement useMemo for heavy calculations
- UseCallback for event handlers
- Lazy loading for non-critical components

## 🧪 Testing Recommendations

### Unit Testing
- Component rendering tests
- Function logic validation
- Error handling verification

### Integration Testing
- API endpoint functionality
- Authentication flow
- File upload process

### Performance Testing
- Large dataset handling
- PDF generation with complex reports
- Concurrent user scenarios

## 📈 Future Improvements

### Technical Debt
1. Migrate from localStorage to secure cookie authentication
2. Implement proper error boundaries
3. Add comprehensive input validation
4. Optimize bundle size with code splitting

### Feature Enhancements
1. Real-time data updates with WebSockets
2. Advanced filtering and search capabilities
3. Mobile-responsive design improvements
4. Offline functionality with service workers

### Monitoring & Analytics
1. Error tracking and reporting
2. Performance monitoring
3. User behavior analytics
4. System health dashboards

---

**Last Updated**: January 2025
**Maintainer**: Development Team
**Version**: 1.0.0 