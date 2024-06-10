import fs from "fs";
import fetch from "node-fetch";
import Parser from "rss-parser";
import { escapeMarkdown, format12HourTime, getMonthAbbreviation, splitNewLine } from "./helpers.js";

const parser = new Parser();

const primary_url = "https://www.upwork.com/ab/feed/jobs/rss?sort=recency&or_terms=%22front+end%22%2C+%22HTML%22%2C+%22css%22%2C+%22js%22%2C+%22react.js%22%2C+%22typescript%22%2C+%22tailwind%22%2C+%22bootstrap%22%2C+%22nextjs%22%2C&verified_payment_only=1&securityToken=304f9ca446b59a5c976f4e3e1097e3a1346d6daf961ac94ae08fc611810866da96f5be6e633a17a996a4a3db48a1a0c6d3eb8397e3b3351b83e8506fd8099f63&userUid=1682473442114174976&orgUid=1682473442114174977";

const getNewJobs = async (latestPubDate) => {
  try {
    const results = [];
    const feed = await parser.parseURL(primary_url);

    feed.items.forEach((item) => {
      const pubDate = new Date(item.pubDate).getTime();
      if (pubDate > latestPubDate) {
        const snippet = item.contentSnippet;
        const budgetIdx = snippet.indexOf("Budget:");
        const hourlyIdx = snippet.indexOf("Hourly Range:");
        const postIdx = snippet.indexOf("Posted On:");
        const subSnippet = snippet.slice(postIdx);
        const categoryIdx = subSnippet.indexOf("Category:");
        const skillsIdx = subSnippet.indexOf("Skills:");
        const idx = item.content.indexOf("<b>");

        let budget = splitNewLine(snippet, budgetIdx);
        if (!/^[$0-9.,]+$/.test(budget)) {
          budget = budget.slice(budget.indexOf("$")).split(" ")[0];
        }

        results.push({
          title: item.title,
          link: item.link.split("?")[0],
          content: item.content.slice(0, idx),
          budget,
          hourly: splitNewLine(snippet, hourlyIdx),
          postOn: pubDate,
          category: splitNewLine(subSnippet, categoryIdx),
          skills: splitNewLine(subSnippet, skillsIdx)
            .split(",")
            .map((skill) => skill.trimStart().trimEnd()),
          unread: true,
        });
      }
    });

    return results;
  } catch (error) {
    console.error("Error fetching or parsing RSS feed:", error);
    return [];
  }
};

(async () => {
  const botToken = "7366603726:AAEUahblU3NF4ElGUToU5cdHGUcdZzQgIRA";
  const chatId = "-1002181396114";

  let latestPubDate = 0;
  let sentJobLinks = new Set();

  try {
    const existingData = fs.readFileSync("output.json", "utf-8");
    if (existingData) {
      const jsonData = JSON.parse(existingData);
      latestPubDate = Math.max(...jsonData.map((item) => item.postOn));
    }

    const sentLinksData = fs.readFileSync("sentLinks.json", "utf-8");
    if (sentLinksData) {
      const sentLinksJson = JSON.parse(sentLinksData);
      sentJobLinks = new Set(sentLinksJson);
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log("No existing data found, starting fresh.");
    } else {
      console.error("Error reading existing data:", err);
      return;
    }
  }

  const updateAndStoreJobs = async () => {
    const newJobs = await getNewJobs(latestPubDate);
    if (newJobs.length > 0) {
      latestPubDate = Math.max(...newJobs.map((item) => item.postOn));
      try {
        const existingData = fs.readFileSync("output.json", "utf-8");
        const jsonData = existingData ? JSON.parse(existingData) : [];
        const updatedData = [...jsonData, ...newJobs];
        fs.writeFileSync("output.json", JSON.stringify(updatedData, null, 2));
        console.log("New jobs added and file updated!");

        for (const job of newJobs) {
          if (sentJobLinks.has(job.link)) {
            console.log(`Job link ${job.link} already sent. Skipping.`);
            continue;
          }

          const postDate = new Date(job.postOn);
          const formattedDate = `${getMonthAbbreviation(postDate.getMonth())} ${postDate.getDate()}, ${format12HourTime(postDate)}`;

          let budgetOrHourlyLine = "";
          if (job.budget && job.hourly) {
            budgetOrHourlyLine = `${escapeMarkdown(job.budget)}\n${escapeMarkdown(job.hourly)}`;
          } else if (job.budget) {
            budgetOrHourlyLine = `${escapeMarkdown(job.budget)}`;
          } else if (job.hourly) {
            budgetOrHourlyLine = `${escapeMarkdown(job.hourly)}`;
          }

          const formattedMessage = `<a href="${job.link}">${escapeMarkdown(job.title)}</a>\n\n${escapeMarkdown(job.content.replace(/<br\s*\/?>\s*(?=<br\s*\/?>)/g, "\n"))}
            \n<strong>${budgetOrHourlyLine ? `<strong>${budgetOrHourlyLine}</strong>\n` : ""}${escapeMarkdown(formattedDate)}</strong>\n${escapeMarkdown(job.category)}\n`;

          const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
          const response = await fetch(sendMessageUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: formattedMessage,
              parse_mode: "HTML",
              disable_web_page_preview: true,
            }),
          });

          const responseData = await response.json();
          if (responseData.ok) {
            console.log("Message sent to Telegram!");
            sentJobLinks.add(job.link);
          } else {
            console.error("Error sending message:", responseData.description);
          }
        }

        fs.writeFileSync("sentLinks.json", JSON.stringify(Array.from(sentJobLinks), null, 2));
      } catch (err) {
        console.error("Error updating data or sending message:", err);
      }
    } else {
      console.log("No new jobs found.");
    }
  };

  updateAndStoreJobs();
  setInterval(updateAndStoreJobs, 30 * 1000);
})();
