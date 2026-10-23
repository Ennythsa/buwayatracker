/* ============ EDIT ME: site settings ============ */
const CONFIG = {
  siteName: "Buwaya Tracker",
  // Your GitHub repo, e.g. https://github.com/yourname/buwaya-tracker
  repoUrl: "https://github.com/YOUR-USERNAME/buwaya-tracker",
  // Link to your zipped C program (upload to GitHub "Releases", then paste the link)
  appDownloadUrl: "https://github.com/YOUR-USERNAME/buwaya-tracker/releases/latest",
  // Data file used by BOTH this website and the C program
  dataFile: "data/candidates.csv",
  delimiter: "|",          // must match what your C code splits on
  listSeparator: ";",      // splits platform/track record into bullet points
  lastUpdated: "Sample data, not real records",
  disclaimer: "Sample data only. Replace data/candidates.csv with verified, sourced records before publishing."
};
