# Demographic Filtering System Architecture

## Overview

The demographic filtering system allows admins and doctors to query and analyze user populations based on various tags, personal information, and device characteristics. The system supports multiple data types and flexible querying patterns.

## Architecture Components

### 1. Frontend Components

#### `DemographicFilter.js`
- **Location**: `frontend/src/components/DemographicFilter.js`
- **Purpose**: Main UI component for demographic filtering
- **Features**:
  - Multi-section accordion interface (Demographics, Medical, Behavioral, Device, Custom)
  - Real-time filtering with debounced API calls
  - Filter preset saving/loading
  - CSV export functionality
  - Responsive design with Material-UI components

#### Filter Types Supported:
- **Boolean Filters**: Yes/No selections (pregnant, diabetes, smoking, etc.)
- **Multi-Select Filters**: Categorical selections (gender, institution, conditions)
- **Range Filters**: Numerical ranges (age 0-100)
- **Custom Search**: Flexible tag=value format parsing

### 2. Backend API Endpoints

#### `GET /api/demographic-tags`
- **Purpose**: Retrieve available demographic tags and their possible values
- **Authorization**: Admins and doctors only
- **Response**: JSON object with categorized tag information
- **Data Structure**:
  ```json
  {
    "demographic": {
      "genders": ["Male", "Female", "Other"],
      "ageRange": {"min": 0, "max": 100},
      "institutions": ["Stanford", "Harvard", "MIT", "UCSF"]
    },
    "medical": {
      "booleanFields": ["pregnant", "diabetes", "high_bp"],
      "conditions": ["pregnancy", "type2_diabetes", "hypertension"]
    },
    "behavioral": {
      "booleanFields": ["smokes", "drinks"],
      "dietTypes": ["Standard", "Vegetarian", "Vegan"]
    },
    "device": {
      "deviceIDs": ["CGM-001", "CGM-002"],
      "arms": ["Left", "Right", "Both"]
    },
    "custom": {
      "availableFields": ["all_discovered_fields"]
    }
  }
  ```

#### `POST /api/demographic-filter`
- **Purpose**: Filter users based on demographic criteria
- **Authorization**: Admins and doctors only (with patient scope restrictions)
- **Request Body**:
  ```json
  {
    "filters": {
      "device_info.gender": ["Male", "Female"],
      "age_range": [25, 65],
      "personal_information.pregnant": true,
      "conditions": ["Type 1 Diabetes"],
      "custom_search": "institution=Stanford,study_group=control"
    },
    "page": 0,
    "limit": 25
  }
  ```
- **Response**: Paginated user results with demographic information

#### `POST /api/demographic-filter/export`
- **Purpose**: Export filtered results to CSV
- **Authorization**: Admins and doctors only
- **Response**: CSV file download

### 3. Database Structure

#### Collections Used:
- **`s3-mongodb-data-entries`**: Main user data collection
  - `username`: User identifier
  - `personal_information`: Medical/demographic tags
  - `device_info`: Device and technical information
  - `updated_at`: Last modification timestamp

#### Sample Data Structure:
```json
{
  "username": "patient001",
  "personal_information": {
    "pregnant": true,
    "diabetes": false,
    "Diabete": false,
    "smokes": false,
    "drinks": true,
    "high_bp": false,
    "High BP": false,
    "hypertension": false,
    "institution": "Stanford",
    "study_group": "intervention",
    "age": 28
  },
  "device_info": {
    "gender": "Female",
    "age": 28,
    "userID": "USR001",
    "deviceID": "CGM-001",
    "arm": "Left"
  }
}
```

## Current Tag Types Supported

### 1. Boolean Tags (True/False)
- `pregnant`: Currently pregnant
- `diabetes`/`Diabete`/`diabete`: Any diabetes type
- `high_bp`/`High BP`/`hypertension`: High blood pressure
- `smokes`: Current smoking status
- `drinks`: Regular alcohol consumption

### 2. Categorical Tags (String/Multi-value)
- `institution`: ["Stanford", "Harvard", "MIT", "UCSF", "Other"]
- `gender`: ["Male", "Female", "Other"]
- `arm`: ["Left", "Right", "Both"]
- `deviceID`: Dynamic based on available devices
- `diet`: ["Standard", "Vegetarian", "Vegan", "Keto", "Low Carb", "Mediterranean"]

### 3. Numerical Tags (Ranges)
- `age`: 0-100 years (from device_info or personal_information)

### 4. Complex Condition Tags
- `conditions`: Multi-select combining multiple conditions
  - "Type 1 Diabetes", "Type 2 Diabetes", "Gestational Diabetes"
  - "Hypertension", "PCOS", "Thyroid"

### 5. Custom Tags (Flexible Format)
- Format: `tag_name=value, tag2=value2`
- Supports: boolean (true/false), numbers, strings
- Example: `institution=Stanford, study_phase=2, active=true`

## Use Cases

### 1. Pregnancy Cohort Analysis
```json
{
  "personal_information.pregnant": true,
  "device_info.gender": ["Female"],
  "age_range": [18, 45]
}
```

### 2. Stanford Diabetes Study
```json
{
  "personal_information.institution": ["Stanford"],
  "conditions": ["Type 1 Diabetes", "Type 2 Diabetes"]
}
```

### 3. Lifestyle Risk Factors
```json
{
  "personal_information.smokes": true,
  "personal_information.drinks": true,
  "personal_information.high_bp": true
}
```

### 4. Custom Research Tags
```json
{
  "custom_search": "study_group=intervention,baseline_hba1c>8.0,enrolled_date>=2024-01-01"
}
```

## Future Extensibility

### 1. Adding New Tag Types

#### For Boolean Tags:
1. Add field to personal_information in database
2. Update CSV upload to include new field
3. Add to backend filter logic in `/api/demographic-filter`
4. Add BooleanFilter component to frontend

#### For Categorical Tags:
1. Define possible values in `/api/demographic-tags` endpoint
2. Add to backend filter logic with `$in` operator
3. Add MultiSelectFilter component to frontend

#### For Custom Complex Tags:
1. Extend `custom_search` parser in backend
2. Add specific validation logic
3. Update frontend helper text and examples

### 2. Advanced Features (Future Development)

#### A. Saved Filter Presets (Implemented)
- Local storage of commonly used filters
- Named presets for quick access
- Sharing presets between users

#### B. Filter Combinations
- AND/OR logic between filter groups
- Nested condition builders
- Advanced query builder UI

#### C. Real-time Analytics
- Live user count updates as filters change
- Population statistics overlay
- Trend analysis over time

#### D. Export Enhancements
- Multiple export formats (JSON, Excel)
- Scheduled exports
- Direct integration with analysis tools

#### E. Tag Management System
- Admin interface for tag definition
- Validation rules for tag values
- Tag versioning and history

## Security & Authorization

### Access Control:
- **Admins**: Full access to all users and demographics
- **Doctors**: Access to their assigned patients only
- **Patients**: No access to demographic filtering
- **Authentication**: JWT token required for all endpoints
- **Data Privacy**: No sensitive medical data in responses unless authorized

### Data Protection:
- Personal information fields are projected safely
- No raw sensor data exposed through filtering
- Audit logging for demographic queries (future enhancement)
- HIPAA compliance considerations for medical tags

## Implementation Guidelines

### Adding a New Institution Tag:
1. **Backend**: Update `demographic-tags` endpoint to include new institution
2. **Frontend**: Add to MultiSelectFilter options for institution
3. **Data**: Ensure CSV uploads can handle new institution value
4. **Testing**: Verify filtering works correctly with new institution

### Adding a Custom Medical Condition:
1. **Backend**: Add condition mapping in `/api/demographic-filter` switch statement
2. **Frontend**: Add to conditions MultiSelectFilter options
3. **Database**: Ensure personal_information contains relevant boolean fields
4. **Documentation**: Update this file with new condition logic

### Performance Considerations:
- MongoDB indexes on frequently queried fields
- Pagination for large result sets
- Debounced frontend API calls
- Result caching for common filter combinations

## Error Handling

### Frontend:
- Network timeouts with retry functionality
- Invalid filter combinations with user feedback
- Missing data gracefully handled with fallbacks

### Backend:
- Malformed filter objects return 400 errors
- Authorization failures return 403 errors
- Database errors return 500 with logging
- Invalid custom search formats are ignored silently

This architecture provides a robust, extensible foundation for demographic querying while maintaining security and performance standards. 