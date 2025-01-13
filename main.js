// node main.js --key zhat_VuWPCQcW78XRw4ufLt3FTdJ8AIyGz5ff-q6jGLcG --client zhci_5rSLVtpSHA28sk9Li2TpGRIVtSejhfIIRbRBkBgC --styleguide 114183

const fs = require("node:fs");

const getOption = (flag) => {
  // Check if an option has been passed in
  if (process.argv.indexOf(flag) != -1) {
    return process.argv[process.argv.indexOf(flag) + 1];
  }
  return false;
};

const key = getOption("--key");
const client = getOption("--client");
const styleguide = getOption("--styleguide");

const fetchData = (endpoint) => {
  return fetch(endpoint, {
    method: "GET",
    headers: {
      "X-API-KEY": key,
      "X-API-CLIENT": client,
    },
  })
    .then((res) => res.json())
    .then((json) => json.data);
};

const fetchPages = () => {
  return fetchData(
    `https://zeroheight.com/open_api/v2/pages/?styleguide_id=${styleguide}`
  );
};

const fetchSinglePage = async (page) => {
  const data = await fetchData(
    `https://zeroheight.com/open_api/v2/pages/${page.id}`
  );
  return data;
};

const template = (page) => {
  return `
<url>
  <loc>${page.url}</loc>
  <lastmod>${page.updated_at.slice(0, 10)}</lastmod>
</url>
  `;
};

const buildSitemap = async (directory) => {
  const content = await fetchPages().then((data) => {
    return Promise.all(data.pages.map((page) => fetchSinglePage(page))).then(
      (pages) => pages.map(({ page }) => template(page))
    );
  });

  const sitemap = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${content.join("")}
</urlset>
    `.trim();

  if (!fs.existsSync(directory)) {
    await fs.mkdirSync(directory);
  }

  fs.writeFileSync(`${directory}/sitemap.xml`, sitemap);
};

buildSitemap("./build/");
