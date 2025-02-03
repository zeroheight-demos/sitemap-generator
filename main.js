const dotenv = require("dotenv");
dotenv.config();

const fs = require("node:fs");

const { KEY, CLIENT, STYLEGUIDE, STYLEGUIDE_TITLE, STYLEGUIDE_URL } =
  process.env;

const getOption = (flag) => {
  if (process.argv.indexOf(flag) != -1) {
    return process.argv[process.argv.indexOf(flag) + 1];
  }
  return false;
};

const path = getOption("--path") || "./build/";

const fetchData = (endpoint) => {
  return fetch(endpoint, {
    method: "GET",
    headers: {
      "X-API-KEY": KEY,
      "X-API-CLIENT": CLIENT,
    },
  })
    .then((res) => res.json())
    .then((json) => json.data);
};

const fetchPages = () => {
  return fetchData(
    `https://zeroheight.com/open_api/v2/pages/?styleguide_id=${STYLEGUIDE}`
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
    `https://zeroheight.com/open_api/v2/styleguides/${STYLEGUIDE}/versions`
  );
};

const sitemapPagePartial = ({ url, updated_at }) => {
  return `
<url>
  <loc>${url}</loc>
  <lastmod>${updated_at.slice(0, 10)}</lastmod>
</url>
  `;
};

const sitemapTabsPartial = (page) => {
  return page.tabs
    .filter((tab) => tab.order !== 1)
    .map((tab) =>
      sitemapPagePartial({ url: tab.url, updated_at: page.updated_at })
    );
};

const rssPartial = (version) => {
  return `
<item>
  <title>${version.name}</title>
  <link>${version.release_url}</link>
  <guid>${version.release_url}</guid>
  <pubDate>${new Date(version.created_at).toUTCString()}</pubDate>
  <content:encoded><![CDATA[${version.release_notes || ""}<p><a href="${
    version.release_url
  }">Browse this version</a></p>]]></content:encoded>
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
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${STYLEGUIDE_TITLE || ""}</title>
    <link>${STYLEGUIDE_URL || ""}</link>
    ${content.join("")}
  </channel>
</rss>
      `.trim();
};

const build = async (directory) => {
  const sitemapContent = await fetchPages().then((data) => {
    return Promise.all(data.pages.map((page) => fetchSinglePage(page))).then(
      (pages) =>
        pages.map(({ page }) => {
          let contentPartial = sitemapPagePartial(page);
          if (page.tabs) {
            contentPartial = contentPartial + sitemapTabsPartial(page);
          }
          console.log(contentPartial);
          return contentPartial;
        })
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

build(path);
