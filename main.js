const dotenv = require("dotenv");
dotenv.config();

const fs = require("node:fs");

const { env } = process;

const getOption = (flag) => {
  // Check if an option has been passed in
  if (process.argv.indexOf(flag) != -1) {
    return process.argv[process.argv.indexOf(flag) + 1];
  }
  return false;
};

const key = getOption("--key") || env.KEY;
const client = getOption("--client") || env.CLIENT;
const styleguide = getOption("--styleguide") || env.STYLEGUIDE;
const title = getOption("--title") || env.STYLEGUIDE_TITLE;
const url = getOption("--url") || env.STYLEGUIDE_URL;

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

const fetchReleases = () => {
  return fetchData(
    `https://zeroheight.com/open_api/v2/styleguides/${styleguide}/versions`
  );
};

const sitemapPartial = (page) => {
  return `
<url>
  <loc>${page.url}</loc>
  <lastmod>${page.updated_at.slice(0, 10)}</lastmod>
</url>
  `;
};

const rssPartial = (version) => {
  return `
<item>
  <title>${version.name}</title>
  <link>${version.release_url}</link>
  <guid>${version.id}</guid>
  <pubDate>${version.created_at}</pubDate>
  <content:encoded><![CDATA[${version.release_notes || ""}]]</content:encoded>
</item>
  `;
};

const sitemapTemplate = (content) => {
  return `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${content.join("")}
</urlset>
    `.trim();
};

const rssTemplate = (content) => {
  return `
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${title || ""}</title>
    <link>${url || ""}</link>
    ${content.join("")}
  </channel>
</rss>
      `.trim();
};

const buildSitemap = async (directory) => {
  const sitemapContent = await fetchPages().then((data) => {
    return Promise.all(data.pages.map((page) => fetchSinglePage(page))).then(
      (pages) => pages.map(({ page }) => sitemapPartial(page))
    );
  });

  const rssContent = await fetchReleases().then((data) => {
    return data.versions.map((version) => rssPartial(version));
  });

  const sitemap = sitemapTemplate(sitemapContent);
  const rss = rssTemplate(rssContent);

  if (!fs.existsSync(directory)) {
    await fs.mkdirSync(directory);
  }

  try {
    fs.writeFileSync(`${directory}/sitemap.xml`, sitemap);
    fs.writeFileSync(`${directory}/rss.xml`, rss);
    console.log(`Sitemap and RSS feed written to ${directory}`);
  } catch (error) {
    console.log(
      `${error}, unable to write sitemap and RSS feed written to ${directory}`
    );
  }
};

buildSitemap("./build/");
