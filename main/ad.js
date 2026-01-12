// main/ad.js
const ads = [
  {
    verified: true,
    title: "RECALLR - Football News",
    ds: "Your hub for football news and match analysis",
    url: "https://recallr.blogspot.com"
  },
  {
    verified: true,
    title: "leprMark",
    ds: "Test your computer speeds",
    url: "/apps/leprmark/leprmark.html"
  }
];

const container = document.getElementById('ad-container');

// Layout styling
Object.assign(container.style, {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "15px",
    padding: "20px 0",
    width: "100%"
});

container.innerHTML = ads.map(data => `
  <div style="all: initial; display: flex; flex-direction: column; width: 260px; padding: 16px; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; font-family: 'Segoe UI', sans-serif; background: #ffffff !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1); box-sizing: border-box;">
    
    <div style="display: ${data.verified ? 'flex' : 'none'}; align-items: center; gap: 5px; margin-bottom: 10px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#1DA1F2"><path d="M22.5 12.5c0-1.58-.88-2.95-2.18-3.65.25-.67.38-1.39.38-2.14 0-3.32-2.68-6-6-6-.75 0-1.47.13-2.14.38C11.95 2.5 10.58 1.5 9 1.5c-3.32 0-6 2.68-6 6 0 .75.13 1.47.38 2.14C2.18 10.3 1.5 11.68 1.5 13.25c0 1.58.88 2.95 2.18 3.65-.25.67-.38 1.39-.38 2.14 0 3.32 2.68 6 6 6 .75 0 1.47-.13 2.14-.38 1.3 1.3 2.68 2.18 4.25 2.18 1.58 0 2.95-.88 3.65-2.18.67.25 1.39.38 2.14.38 3.32 0 6-2.68 6-6 0-.75-.13-1.47-.38-2.14 1.3-.7 2.18-2.07 2.18-3.65zm-11 5.5l-4-4 1.41-1.41L10.5 14.17l6.59-6.59L18.5 9l-7 9z"/></svg>
      <span style="font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Verified Sponsored</span>
    </div>

    <div style="flex-grow: 1; margin-bottom: 15px;">
      <strong style="display: block; font-size: 15px; color: #111; margin-bottom: 4px;">${data.title}</strong>
      <p style="margin: 0; font-size: 13px; color: #444; line-height: 1.4;">${data.ds}</p>
    </div>

    <a href="${data.url}" target="_blank" style="display: block; width: 100%; text-align: center; padding: 10px 0; background: #007bff; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold; transition: opacity 0.2s;">
      View Project
    </a>
  </div>
`).join('');