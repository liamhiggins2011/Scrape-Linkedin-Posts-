"""
LinkedIn post scraper.
- search_linkedin_posts: Uses DuckDuckGo (no account needed)
- scrape_linkedin_posts: Uses Selenium + login (for profile scraping, optional)
"""

import re
import time
import hashlib
import threading
from datetime import datetime
from typing import Callable

from ddgs import DDGS

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import TimeoutException, WebDriverException

    HAS_SELENIUM = True
except ImportError:
    HAS_SELENIUM = False

from bs4 import BeautifulSoup as bs


# ---------------------------------------------------------------------------
# Allowed URL patterns — only actual user content
# ---------------------------------------------------------------------------
_POST_URL_PATTERNS = [
    "/posts/",       # linkedin.com/posts/username_...
    "/pulse/",       # linkedin.com/pulse/article-title
    "/feed/update/", # linkedin.com/feed/update/urn:li:activity:...
]

_BLOCKED_DOMAINS = [
    "business.linkedin.com",
    "training.linkedin.com",
    "news.linkedin.com",
    "engineering.linkedin.com",
    "learning.linkedin.com",
    "ads.linkedin.com",
    "developer.linkedin.com",
]


_BLOCKED_PATHS = [
    "/advice/", "/help/", "/legal/",
    "/jobs/", "/company/", "/school/", "/events/",
    "/groups/", "/learning/", "/showcase/", "/newsletters/",
]


def _is_valid_post_url(url: str) -> bool:
    """Only allow actual LinkedIn user posts and articles."""
    if any(domain in url for domain in _BLOCKED_DOMAINS):
        return False
    if any(path in url for path in _BLOCKED_PATHS):
        return False
    # Block query-string-only URLs (no meaningful path after domain)
    if re.search(r'linkedin\.com/?\?', url):
        return False
    # Block /in/ profile-only URLs (without /posts/ or /activity/)
    if "/in/" in url and not any(p in url for p in ["/posts/", "/activity/", "/pulse/"]):
        return False
    return any(pattern in url for pattern in _POST_URL_PATTERNS)


# ---------------------------------------------------------------------------
# DuckDuckGo-based search (NO account needed)
# ---------------------------------------------------------------------------

# DuckDuckGo timelimit values
_TIME_MAP = {
    "any": None,
    "day": "d",
    "week": "w",
    "month": "m",
    "year": "y",
}

# LinkedIn native search datePosted URL param values
_LINKEDIN_DATE_MAP = {
    "day": "past-24h",
    "week": "past-week",
    "month": "past-month",
}


_REGION_MAP = {
    "any": None,
    # US States
    "us": "us-en",
    "alabama": "us-en", "alaska": "us-en", "arizona": "us-en", "arkansas": "us-en",
    "california": "us-en", "colorado": "us-en", "connecticut": "us-en", "delaware": "us-en",
    "florida": "us-en", "georgia-us": "us-en", "hawaii": "us-en", "idaho": "us-en",
    "illinois": "us-en", "indiana": "us-en", "iowa": "us-en", "kansas": "us-en",
    "kentucky": "us-en", "louisiana": "us-en", "maine": "us-en", "maryland": "us-en",
    "massachusetts": "us-en", "michigan": "us-en", "minnesota": "us-en", "mississippi": "us-en",
    "missouri": "us-en", "montana": "us-en", "nebraska": "us-en", "nevada": "us-en",
    "new-hampshire": "us-en", "new-jersey": "us-en", "new-mexico": "us-en", "new-york": "us-en",
    "north-carolina": "us-en", "north-dakota": "us-en", "ohio": "us-en", "oklahoma": "us-en",
    "oregon": "us-en", "pennsylvania": "us-en", "rhode-island": "us-en", "south-carolina": "us-en",
    "south-dakota": "us-en", "tennessee": "us-en", "texas": "us-en", "utah": "us-en",
    "vermont": "us-en", "virginia": "us-en", "washington": "us-en", "west-virginia": "us-en",
    "wisconsin": "us-en", "wyoming": "us-en",
    # Countries
    "uk": "uk-en", "canada": "ca-en", "australia": "au-en", "india": "in-en",
    "germany": "de-de", "france": "fr-fr", "brazil": "br-pt", "mexico": "mx-es",
    "spain": "es-es", "italy": "it-it", "netherlands": "nl-nl", "japan": "jp-jp",
    "south-korea": "kr-kr", "singapore": "sg-en", "ireland": "ie-en",
    "sweden": "se-sv", "switzerland": "ch-de", "israel": "il-he",
    "uae": "ae-ar", "south-africa": "za-en", "nigeria": "ng-en",
    "philippines": "ph-en", "indonesia": "id-en", "poland": "pl-pl",
}

# Human-readable labels for location keys (used for query keywords)
_LOCATION_LABELS = {
    "alabama": "Alabama", "alaska": "Alaska", "arizona": "Arizona", "arkansas": "Arkansas",
    "california": "California", "colorado": "Colorado", "connecticut": "Connecticut",
    "delaware": "Delaware", "florida": "Florida", "georgia-us": "Georgia",
    "hawaii": "Hawaii", "idaho": "Idaho", "illinois": "Illinois", "indiana": "Indiana",
    "iowa": "Iowa", "kansas": "Kansas", "kentucky": "Kentucky", "louisiana": "Louisiana",
    "maine": "Maine", "maryland": "Maryland", "massachusetts": "Massachusetts",
    "michigan": "Michigan", "minnesota": "Minnesota", "mississippi": "Mississippi",
    "missouri": "Missouri", "montana": "Montana", "nebraska": "Nebraska", "nevada": "Nevada",
    "new-hampshire": "New Hampshire", "new-jersey": "New Jersey", "new-mexico": "New Mexico",
    "new-york": "New York", "north-carolina": "North Carolina", "north-dakota": "North Dakota",
    "ohio": "Ohio", "oklahoma": "Oklahoma", "oregon": "Oregon", "pennsylvania": "Pennsylvania",
    "rhode-island": "Rhode Island", "south-carolina": "South Carolina",
    "south-dakota": "South Dakota", "tennessee": "Tennessee", "texas": "Texas", "utah": "Utah",
    "vermont": "Vermont", "virginia": "Virginia", "washington": "Washington",
    "west-virginia": "West Virginia", "wisconsin": "Wisconsin", "wyoming": "Wyoming",
    "us": "United States", "uk": "United Kingdom", "canada": "Canada", "australia": "Australia",
    "india": "India", "germany": "Germany", "france": "France", "brazil": "Brazil",
    "mexico": "Mexico", "spain": "Spain", "italy": "Italy", "netherlands": "Netherlands",
    "japan": "Japan", "south-korea": "South Korea", "singapore": "Singapore",
    "ireland": "Ireland", "sweden": "Sweden", "switzerland": "Switzerland", "israel": "Israel",
    "uae": "UAE", "south-africa": "South Africa", "nigeria": "Nigeria",
    "philippines": "Philippines", "indonesia": "Indonesia", "poland": "Poland",
}


def search_linkedin_posts(
    query: str,
    max_posts: int = 20,
    content_type: str = "posts",
    time_range: str = "any",
    location: str = "any",
    on_post_found: Callable[[int], None] | None = None,
    **kwargs,
) -> list[dict]:
    """
    Search for LinkedIn posts via DuckDuckGo.
    No LinkedIn account required.

    content_type: "posts" (user posts), "articles" (pulse articles), "all"
    time_range: "any", "day", "week", "month", "year"
    location: "any", US state slug, or country slug
    """
    # Build location keyword to add to the search
    location_keyword = ""
    if location and location != "any":
        location_keyword = _LOCATION_LABELS.get(location, location.replace("-", " ").title())

    # Build targeted search query
    loc_part = f' "{location_keyword}"' if location_keyword else ""
    if content_type == "posts":
        search_query = f'site:linkedin.com/posts "{query}"{loc_part}'
    elif content_type == "articles":
        search_query = f'site:linkedin.com/pulse "{query}"{loc_part}'
    else:
        search_query = f'site:linkedin.com/posts OR site:linkedin.com/pulse "{query}"{loc_part}'

    timelimit = _TIME_MAP.get(time_range)
    region = _REGION_MAP.get(location) if location else None

    # Request extra results since we'll filter some out
    fetch_count = min(max_posts * 3, 150)

    ddgs_kwargs: dict = {"max_results": fetch_count}
    if timelimit:
        ddgs_kwargs["timelimit"] = timelimit
    if region:
        ddgs_kwargs["region"] = region

    results = []
    for r in DDGS().text(search_query, **ddgs_kwargs):
        result = _parse_ddg_result(r)
        if result:
            results.append(result)
            if on_post_found:
                on_post_found(len(results))
            if len(results) >= max_posts:
                break

    return results


def _activity_id_to_datetime(post_id: str) -> datetime | None:
    """Extract the actual post date from a LinkedIn activity ID (snowflake-style)."""
    try:
        aid = int(post_id)
        if aid < 1_000_000_000:  # Not a valid activity ID (e.g. MD5 hash)
            return None
        ts_ms = aid >> 22
        return datetime.fromtimestamp(ts_ms / 1000)
    except (ValueError, OSError, OverflowError):
        return None


def _parse_ddg_result(result: dict) -> dict | None:
    """Parse a DuckDuckGo search result into our post format."""
    url = result.get("href", "")
    title = result.get("title", "")
    snippet = result.get("body", "")

    if not url or "linkedin.com" not in url:
        return None

    # Filter: only actual posts/articles
    if not _is_valid_post_url(url):
        return None

    # Extract author name from title patterns
    author_name = ""
    post_title = ""
    content = snippet

    if " on LinkedIn:" in title:
        parts = title.split(" on LinkedIn:", 1)
        author_name = parts[0].strip()
        post_title = parts[1].strip()
        content = (post_title + "\n" + snippet).strip() if post_title else snippet
    elif " posted on LinkedIn" in title:
        parts = title.split(" posted on LinkedIn", 1)
        author_name = parts[0].strip()
        content = snippet
    elif " | LinkedIn" in title:
        parts = title.split(" | LinkedIn", 1)
        # Could be author or article title
        if "/pulse/" in url:
            post_title = parts[0].strip()
            content = (post_title + "\n" + snippet).strip()
        else:
            author_name = parts[0].strip()

    # Try to extract author from URL for /posts/ URLs
    # e.g. linkedin.com/posts/john-smith_topic-activity-123
    if not author_name and "/posts/" in url:
        match = re.search(r"linkedin\.com/posts/([^_/]+)", url)
        if match:
            raw = match.group(1)
            # Convert slug to name: "john-smith" -> "John Smith"
            author_name = raw.replace("-", " ").title()

    # Generate stable post_id
    post_id = hashlib.md5(url.encode()).hexdigest()[:16]

    if "urn:li:activity:" in url:
        post_id = url.split("urn:li:activity:")[-1].replace("/", "").strip()
    elif "/posts/" in url:
        match = re.search(r"activity[_-](\d+)", url)
        if match:
            post_id = match.group(1)

    # Extract author profile link
    author_profile = ""
    if "/posts/" in url:
        match = re.search(r"(https?://[^/]*linkedin\.com/in/[^/]+)", url)
        if not match:
            slug_match = re.search(r"linkedin\.com/posts/([^_/]+)", url)
            if slug_match:
                author_profile = f"https://www.linkedin.com/in/{slug_match.group(1)}/"

    # Strip date prefix from content if present (e.g. "Jun 18, 2025 ·")
    final_content = content or title
    date_prefix = re.match(
        r'^(\w{3}\s+\d{1,2},\s+\d{4}|\d+\s+(?:hours?|days?|weeks?|months?|years?)\s+ago)\s*[\u00b7·\-]\s*',
        final_content,
    )
    if date_prefix:
        final_content = final_content[date_prefix.end():].strip()

    # Extract the actual post date from the LinkedIn activity ID
    # LinkedIn uses snowflake-style IDs: timestamp_ms = id >> 22
    actual_date = _activity_id_to_datetime(post_id)
    post_time = actual_date.strftime("%b %d, %Y") if actual_date else ""
    date_collected = actual_date if actual_date else datetime.utcnow()

    return {
        "post_id": post_id,
        "post_url": url,
        "author_name": author_name,
        "author_profile": author_profile,
        "author_jobtitle": "",
        "post_time": post_time,
        "content": final_content,
        "reactions": 0,
        "comments": 0,
        "impressions": 0,
        "date_collected": date_collected,
    }


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
def convert_abbreviated_to_number(s):
    s = s.upper().strip().replace(",", "")
    try:
        if s.endswith("K"):
            return int(float(s[:-1]) * 1000)
        elif s.endswith("M"):
            return int(float(s[:-1]) * 1000000)
        else:
            return int(s)
    except (ValueError, TypeError):
        return 0


def _parse_posts_from_soup(soup, unique_post_ids):
    """Parse post data from a BeautifulSoup page. Returns list of new post dicts."""
    posts = []
    post_wrappers = soup.find_all("div", {"class": "feed-shared-update-v2"})

    for pw in post_wrappers:
        post_id = None
        post_url = None

        detail_link_tag = pw.find(
            "a", {"class": "update-components-mini-update-v2__link-to-details-page"}
        )
        if detail_link_tag and detail_link_tag.get("href"):
            post_url = detail_link_tag["href"].strip()
            if "urn:li:activity:" in post_url:
                part = post_url.split("urn:li:activity:")[-1].replace("/", "")
                post_id = part

        if not post_id:
            data_urn = pw.get("data-urn", "")
            if "urn:li:activity:" in data_urn:
                post_id = data_urn.split("urn:li:activity:")[-1]

        if not post_id or post_id in unique_post_ids:
            continue

        unique_post_ids.add(post_id)

        if post_url and post_url.startswith("/feed/update/"):
            post_url = "https://www.linkedin.com" + post_url

        author_name = None
        author_profile_link = None
        author_jobtitle = None
        post_time = None

        actor_container = pw.find("div", {"class": "update-components-actor__container"})
        if actor_container:
            name_tag = actor_container.find("span", {"class": "update-components-actor__title"})
            if name_tag:
                inner_span = name_tag.find("span", {"dir": "ltr"})
                if inner_span:
                    author_name = inner_span.get_text(strip=True)

            actor_link = actor_container.find("a", {"class": "update-components-actor__meta-link"})
            if actor_link and actor_link.get("href"):
                author_profile_link = actor_link["href"].strip()
                if author_profile_link.startswith("/in/"):
                    author_profile_link = "https://www.linkedin.com" + author_profile_link

            jobtitle_tag = actor_container.find(
                "span", {"class": "update-components-actor__description"}
            )
            if jobtitle_tag:
                author_jobtitle = jobtitle_tag.get_text(strip=True)

            time_tag = actor_container.find(
                "span", {"class": "update-components-actor__sub-description"}
            )
            if time_tag:
                post_time = time_tag.get_text(strip=True)

        post_content = None
        content_div = pw.find("div", {"class": "update-components-text"})
        if content_div:
            post_content = content_div.get_text(separator="\n", strip=True)

        post_reactions = 0
        post_comments = 0
        post_impressions = 0

        social_counts_div = pw.find("div", {"class": "social-details-social-counts"})
        if social_counts_div:
            reaction_item = social_counts_div.find(
                "li", {"class": "social-details-social-counts__reactions"}
            )
            if reaction_item:
                button_tag = reaction_item.find("button")
                if button_tag and button_tag.has_attr("aria-label"):
                    raw_reactions = button_tag["aria-label"].split(" ")[0]
                    post_reactions = convert_abbreviated_to_number(raw_reactions)

            comment_item = social_counts_div.find(
                "li", {"class": "social-details-social-counts__comments"}
            )
            if comment_item:
                cbutton_tag = comment_item.find("button")
                if cbutton_tag and cbutton_tag.has_attr("aria-label"):
                    raw_comments = cbutton_tag["aria-label"].split(" ")[0]
                    post_comments = convert_abbreviated_to_number(raw_comments)

        impressions_span = pw.find("span", {"class": "analytics-entry-point"})
        if impressions_span:
            possible_text = impressions_span.get_text(strip=True)
            if "impressions" in possible_text.lower():
                raw_impressions = (
                    possible_text.lower().replace("impressions", "").strip().split(" ")[0]
                )
                post_impressions = convert_abbreviated_to_number(raw_impressions)

        posts.append({
            "post_id": post_id,
            "post_url": post_url or "",
            "author_name": author_name or "",
            "author_profile": author_profile_link or "",
            "author_jobtitle": author_jobtitle or "",
            "post_time": post_time or "",
            "content": post_content or "",
            "reactions": post_reactions,
            "comments": post_comments,
            "impressions": post_impressions,
            "date_collected": datetime.utcnow(),
        })

    return posts


# ---------------------------------------------------------------------------
# Selenium-based LinkedIn native search (requires login)
# ---------------------------------------------------------------------------
def search_linkedin_native(
    query: str,
    max_posts: int = 20,
    content_type: str = "posts",
    time_range: str = "any",
    location: str = "any",
    cookie_path: str | None = None,
    email: str | None = None,
    password: str | None = None,
    max_scroll_attempts: int = 40,
    max_no_new_posts: int = 3,
    on_post_found: Callable[[int], None] | None = None,
) -> list[dict]:
    """
    Search LinkedIn directly via Selenium for better results and real engagement data.
    Requires Selenium and a LinkedIn login.
    Falls back caller should catch exceptions and fall back to DDG.
    """
    if not HAS_SELENIUM:
        raise RuntimeError("Selenium is not installed.")

    if not cookie_path and not (email and password):
        raise RuntimeError("Either cookie_path or email+password must be provided.")

    from urllib.parse import quote_plus

    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    browser = webdriver.Chrome(options=chrome_options)
    browser.set_window_size(1920, 1080)

    try:
        # --- Login (reuse existing flow) ---
        if email and password:
            browser.get("https://www.linkedin.com/login")
            time.sleep(2)
            email_field = WebDriverWait(browser, 10).until(
                EC.presence_of_element_located((By.ID, "username"))
            )
            email_field.clear()
            email_field.send_keys(email)
            password_field = browser.find_element(By.ID, "password")
            password_field.clear()
            password_field.send_keys(password)
            password_field.submit()
            time.sleep(3)
        elif cookie_path:
            browser.get("https://www.linkedin.com/")
            time.sleep(2)
            from scraper import load_cookies
            load_cookies(browser, cookie_path)
            browser.refresh()

        try:
            WebDriverWait(browser, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "#global-nav"))
            )
        except TimeoutException:
            raise RuntimeError("Login failed — check your credentials.")

        # --- Build search URL ---
        encoded_query = quote_plus(query)
        date_param = _LINKEDIN_DATE_MAP.get(time_range, "")
        url = f"https://www.linkedin.com/search/results/content/?keywords={encoded_query}&origin=FACETED_SEARCH&sortBy=date_posted"
        if date_param:
            url += f"&datePosted={date_param}"

        browser.get(url)
        time.sleep(5)

        # --- Scroll and parse (same pattern as scrape_linkedin_posts) ---
        unique_post_ids: set[str] = set()
        all_posts: list[dict] = []
        scroll_attempts = 0
        no_new_posts_count = 0

        while (
            len(all_posts) < max_posts
            and scroll_attempts < max_scroll_attempts
            and no_new_posts_count < max_no_new_posts
        ):
            soup = bs(browser.page_source, "html.parser")
            new_posts = _parse_posts_from_soup(soup, unique_post_ids)

            if not new_posts:
                no_new_posts_count += 1
            else:
                no_new_posts_count = 0
                all_posts.extend(new_posts)
                if on_post_found:
                    on_post_found(len(all_posts))

            if len(all_posts) >= max_posts:
                all_posts = all_posts[:max_posts]
                break

            browser.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(4)
            scroll_attempts += 1

        return all_posts

    finally:
        browser.quit()


# ---------------------------------------------------------------------------
# Selenium-based profile scraper (requires login — optional)
# ---------------------------------------------------------------------------
def scrape_linkedin_posts(
    profile_url: str,
    max_posts: int = 20,
    cookie_path: str | None = None,
    email: str | None = None,
    password: str | None = None,
    max_scroll_attempts: int = 40,
    max_no_new_posts: int = 3,
    on_post_found: Callable[[int], None] | None = None,
) -> list[dict]:
    """
    Scrape LinkedIn posts from a user's activity page.
    Requires Selenium and a LinkedIn login.
    """
    if not HAS_SELENIUM:
        raise RuntimeError("Selenium is not installed. Profile scraping requires Selenium.")

    if not cookie_path and not (email and password):
        raise RuntimeError("Either cookie_path or email+password must be provided.")

    if "/recent-activity/" not in profile_url:
        profile_url = profile_url.rstrip("/") + "/recent-activity/all/"

    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    browser = webdriver.Chrome(options=chrome_options)
    browser.set_window_size(1920, 1080)

    try:
        if email and password:
            browser.get("https://www.linkedin.com/login")
            time.sleep(2)
            email_field = WebDriverWait(browser, 10).until(
                EC.presence_of_element_located((By.ID, "username"))
            )
            email_field.clear()
            email_field.send_keys(email)
            password_field = browser.find_element(By.ID, "password")
            password_field.clear()
            password_field.send_keys(password)
            password_field.submit()
            time.sleep(3)
        elif cookie_path:
            browser.get("https://www.linkedin.com/")
            time.sleep(2)
            from scraper import load_cookies
            load_cookies(browser, cookie_path)
            browser.refresh()

        try:
            WebDriverWait(browser, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "#global-nav"))
            )
        except TimeoutException:
            raise RuntimeError("Login failed — check your credentials.")

        browser.get(profile_url)
        time.sleep(5)

        unique_post_ids: set[str] = set()
        all_posts: list[dict] = []
        scroll_attempts = 0
        no_new_posts_count = 0

        while (
            len(all_posts) < max_posts
            and scroll_attempts < max_scroll_attempts
            and no_new_posts_count < max_no_new_posts
        ):
            soup = bs(browser.page_source, "html.parser")
            new_posts = _parse_posts_from_soup(soup, unique_post_ids)

            if not new_posts:
                no_new_posts_count += 1
            else:
                no_new_posts_count = 0
                all_posts.extend(new_posts)
                if on_post_found:
                    on_post_found(len(all_posts))

            if len(all_posts) >= max_posts:
                all_posts = all_posts[:max_posts]
                break

            browser.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(4)
            scroll_attempts += 1

        return all_posts

    finally:
        browser.quit()
