const ads = [
  {
    verified: true,
    tittle: "RECALLR - Football News",
    ds: "Your hub for football news and match analysis",
    url: "https://recallr.blogspot.com"
  }
];

const container = document.getElementById('ad-container');

// Set container to flex row
container.style.display = "flex";
container.style.flexWrap = "wrap";
container.style.justifyContent = "center";
container.style.gap = "20px";
container.style.padding = "20px";

container.innerHTML = ads.map(data => `
  <div style="all: initial; display: block; width: 250px; padding: 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-family: sans-serif; background: #ffffff !important; box-shadow: 0 2px 4px rgba(0,0,0,0.05); text-align: left;">
    
    <div style="display: ${data.verified ? 'flex' : 'none'}; align-items: center; gap: 4px; margin-bottom: 8px;">
      <i class="fas fa-check-circle" style="color: #1DA1F2; font-size: 10px;"></i>
      <span style="font-size: 10px; color: #666; font-family: sans-serif;">Verified Sponsored</span>
    </div>

    <div style="margin-bottom: 10px;">
      <strong style="display: block; font-size: 14px; color: #222; font-family: sans-serif; font-weight: bold;">${data.tittle}</strong>
      <p style="margin: 4px 0 0; font-size: 12px; color: #555; font-family: sans-serif; line-height: 1.2;">${data.ds}</p>
    </div>

    <a href="${data.url}" target="_blank" style="display: block; width: 100%; text-align: center; padding: 8px 0; background: #007bff; color: #ffffff !important; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: bold; font-family: sans-serif;">
      View
    </a>
  </div>
`).join('');