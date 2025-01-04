const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Replace with your Bitbucket Server base URL
const BITBUCKET_BASE_URL = 'https://your-bitbucket-server';

// Replace with your credentials or OAuth token
const AUTH_TOKEN = 'your-auth-token';

// Helper function to fetch data with pagination
const fetchPaginatedData = async (url, params) => {
  let results = [];
  let isLastPage = false;
  let start = 0;

  while (!isLastPage) {
    const response = await axios.get(url, {
      params: { ...params, start },
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });

    const data = response.data;
    results = results.concat(data.values);
    isLastPage = data.isLastPage;
    start = data.nextPageStart;
  }

  return results;
};

// Endpoint to fetch commit count for a specific author across all repositories
app.get('/commits', async (req, res) => {
  const { author, startDate, endDate } = req.query;

  if (!author || !startDate || !endDate) {
    return res.status(400).send('Missing required query parameters: author, startDate, endDate');
  }

  try {
    // Fetch all projects
    const projects = await fetchPaginatedData(`${BITBUCKET_BASE_URL}/rest/api/1.0/projects`);

    let totalCommits = 0;

    // Iterate over each project
    for (const project of projects) {
      const projectKey = project.key;

      // Fetch all repositories in the project
      const repos = await fetchPaginatedData(`${BITBUCKET_BASE_URL}/rest/api/1.0/projects/${projectKey}/repos`);

      // Iterate over each repository
      for (const repo of repos) {
        const repoSlug = repo.slug;

        // Fetch commits in the repository
        const commits = await fetchPaginatedData(
          `${BITBUCKET_BASE_URL}/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/commits`,
          {
            author,
            since: startDate,
            until: endDate,
          }
        );

        // Count commits by the author within the date range
        const commitCount = commits.filter(commit => {
          const commitDate = new Date(commit.authorTimestamp);
          return commit.author.name === author && commitDate >= new Date(startDate) && commitDate <= new Date(endDate);
        }).length;

        totalCommits += commitCount;
      }
    }

    res.json({
      author,
      startDate,
      endDate,
      totalCommits,
    });
  } catch (error) {
    console.error('Error fetching commits:', error.message);
    res.status(500).send('Failed to fetch commits. Check your configuration.');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
