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
  console.log(`Fetching data from endpoint: ${endpoint}`);
  return fetch(endpoint, {
    method: "GET",
    headers: {
      "X-API-KEY": KEY,
      "X-API-CLIENT": CLIENT,
    },
  })
    .then((res) => res.json())
    .then((json) => {
      console.log(`Data fetched from endpoint: ${endpoint}`, json);
      return json.data;
    })
    .catch((error) => {
      console.error(`Error fetching data from endpoint: ${endpoint}`, error);
      throw error;
    });
};

const fetchPages = () => {
  return fetchData(
    `https://zeroheight.com/open_api/v2/pages/?styleguide_id=${STYLEGUIDE}`
  );
};

const fetchSinglePage = async (page) => {
  console.log(`Fetching single page: ${page.id}`);
  const data = await fetchData(
    `https://zeroheight.com/open_api/v2/pages/${page.id}`
  );
  console.log(`Data fetched for single page: ${page.id}`, data);
  return data;
};

const fetchReleases = () => {
  return fetchData(
    `https://zeroheight.com/open_api/v2/styleguides/${STYLEGUIDE}/versions`
  );
};

const sitemapPagePartial = ({ url, updated_at }) => {
  if (!url || !updated_at) {
    console.error(`Invalid page data: url=${url}, updated_at=${updated_at}`);
    return '';
  }
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

const indexTemplate = () => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>zeroheight Styleguide Sitemap &amp; RSS Feed</title>
      </head>
      <body>
        <h1>zeroheight Styleguide Sitemap &amp; RSS Feed</h1>
        <ul>
          <li>
            <a href="./sitemap.xml">Sitemap example</a> |
            <a href="./sitemap.xml" download>Download</a>
          </li>
          <li>
            <a href="./rss.xml">RSS feed example</a> |
            <a href="./rss.xml" download>Download</a>
          </li>
          <li><a href="${STYLEGUIDE_URL || ""}">Original styleguide</a></li>
        </ul>
      </body>
    </html>
  `;
};

const build = async (directory) => {
  console.log(`Building sitemap and RSS feed in directory: ${directory}`);
  const sitemapContent = await fetchPages().then((data) => {
    console.log(`Pages fetched:`, data);
    return Promise.all(data.pages.map((page) => fetchSinglePage(page))).then(
      (pages) => {
        console.log(`Single pages fetched:`, pages);
        return pages.map(({ page }) => {
          if (!page) {
            console.error(`Page is undefined:`, page);
            return '';
          }
          let contentPartial = sitemapPagePartial(page);
          if (page.tabs) {
            contentPartial = contentPartial + sitemapTabsPartial(page);
          }
          return contentPartial;
        });
      }
    );
  });

  const rssContent = await fetchReleases().then((data) => {
    console.log(`Releases fetched:`, data);
    if (!data || !data.versions) {
      console.error(`Invalid releases data:`, data);
      return [];
    }
    return data.versions.map((version) => rssPartial(version));
  });

  const sitemap = sitemapTemplate(sitemapContent);
  const rss = rssTemplate(rssContent);
  const index = indexTemplate();

  if (!fs.existsSync(directory)) {
    console.log(`Directory does not exist, creating: ${directory}`);
    await fs.mkdirSync(directory);
  }

  try {
    fs.writeFileSync(`${directory}/sitemap.xml`, sitemap);
    fs.writeFileSync(`${directory}/rss.xml`, rss);
    fs.writeFileSync(`${directory}/index.html`, index);
    console.log(`Sitemap and RSS feed written to ${directory}`);
  } catch (error) {
    console.error(
      `${error}, unable to write sitemap and RSS feed to ${directory}`
    );
  }
};

build(path);
