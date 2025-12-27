# Product Requirements Document (PRD) - Transcriptify

| **Project Name** | Transcriptify |
| :--- | :--- |
| **Version** | 1.0 |
| **Status** | MVP + Advanced Features Complete |
| **Last Updated** | December 27, 2025 |
| **Target Audience** | UDST Students |

---

## 1. Executive Summary
**Transcriptify** is a privacy-first, client-side web application designed to help UDST students visualize their academic performance. By parsing PDF transcripts directly in the browser, it transforms raw data into interactive charts, diagnostic insights, and predictive tools, enabling students to make informed decisions about their academic trajectory without compromising their data privacy.

## 2. Problem Statement
Students often struggle to interpret their academic progress from static PDF transcripts. They lack tools to:
*   Visualize trends over time (e.g., "Is my GPA improving?").
*   Understand the impact of specific subjects on their overall performance.
*   Simulate how future grades will affect their Cumulative GPA (CGPA).
*   Identify specific areas of strength or weakness (e.g., "Am I better at practical or theoretical courses?").

## 3. Goals & Objectives
*   **Privacy First**: Ensure 100% client-side processing. No student data is ever sent to a server.
*   **Visual Clarity**: Transform tabular data into intuitive visualizations (Line Charts, Radar Charts, Bar Graphs).
*   **Actionable Insights**: Provide diagnostic feedback and strategic advice based on performance patterns.
*   **Predictive Capability**: Allow students to simulate future scenarios to plan their academic path.

## 4. Functional Requirements

### 4.1. Core Functionality
*   **PDF Parsing**:
    *   Drag-and-drop interface for UDST PDF transcripts.
    *   Client-side parsing using `pdfjs-dist`.
    *   Regex-based extraction of Course Code, Title, Credits, Grade, and Points.
    *   Intelligent handling of "Exemptions" and multi-line course titles.
*   **Data Persistence**:
    *   "Remember Me" functionality using `localStorage` to persist data between sessions.
    *   "Clear Data" option to wipe local storage.

### 4.2. Dashboard & Visualization
*   **Key Metrics**: Display CGPA, Total Credits Earned, and Total Courses Completed.
*   **GPA Trend Graph**:
    *   Line chart showing Term GPA vs. Cumulative GPA over time.
    *   **Interactive Drill-Down**: Clicking a term filters the course list to show only that term's data.
*   **Grade Distribution**:
    *   Bar chart showing the frequency of each letter grade.
    *   **Toggle**: Switch between "By Count" (number of courses) and "By Credits" (weighted impact).
*   **Subject Proficiency Radar**:
    *   Radar chart grouping performance by subject area (e.g., Core AI, Math, General).
    *   **Interactive Tooltip**: Hovering over a subject lists the specific courses contributing to that score.

### 4.3. Advanced Interactivity
*   **Global State Filtering**:
    *   Unified filtering logic. Selecting a subject (e.g., "Math") filters the Trend Graph, Radar Chart, and Course List simultaneously.
*   **"What-If" GPA Simulator**:
    *   Calculator to add hypothetical courses with customizable Credits (1-9) and Grades.
    *   Real-time projection of future CGPA based on current stats + hypothetical data.

### 4.4. Intelligent Insights (Insight Engine)
*   **Performance Diagnosis**:
    *   **Volatility Analysis**: Calculates consistency of performance (Standard Deviation).
    *   **Credit Impact**: Compares performance in high-credit vs. low-credit courses.
    *   **Subject Strength**: Identifies strongest and weakest subject areas.
*   **Narrative Generation**:
    *   Rule-based engine generating a 3-part personalized summary:
        1.  **Trajectory**: (e.g., "V-Shaped Recovery", "Consistent Growth").
        2.  **Diagnosis**: (e.g., "Strong in Core AI but dragged down by Math").
        3.  **Advice**: (e.g., "Focus on high-credit courses to stabilize CGPA").
*   **Visual Indicators**:
    *   **Status Badge**: "High Achiever", "Consistent", "At Risk", etc.
    *   **Trend Indicator**: Visual arrow and slope showing recent performance direction.
    *   **Key Takeaway**: Highlights the single most impactful course or opportunity.

### 4.5. Utilities
*   **Resume Bullet Generator**: One-click generation of a professional summary string for resumes (e.g., "Maintained a 3.8 CGPA across 90 credits...").

## 5. Non-Functional Requirements
*   **Security & Privacy**: Zero-knowledge architecture. All parsing and logic execute in the user's browser.
*   **Performance**: Instant parsing and rendering (<2 seconds for typical transcripts).
*   **Responsiveness**: Fully responsive UI using Tailwind CSS, optimized for Desktop and Tablet.
*   **Usability**: Clean, "SaaS-like" aesthetic using ShadCN-inspired components and Lucide icons.

## 6. Technical Architecture
*   **Framework**: Next.js 14 (App Router).
*   **Language**: TypeScript.
*   **Styling**: Tailwind CSS, clsx, tailwind-merge.
*   **Visualization Library**: Recharts.
*   **PDF Processing**: pdfjs-dist (Legacy build for Node/Browser compatibility).
*   **Icons**: Lucide React.

## 7. Future Roadmap (Post-v1.0)
*   **Multi-Transcript Support**: Compare progress across multiple degrees or institutions.
*   **Curriculum Mapping**: Map parsed courses against a degree plan to show "% Degree Completed".
*   **Export to PDF**: Generate a printable report of the dashboard.
*   **Dark Mode**: Full system-wide dark mode support.
