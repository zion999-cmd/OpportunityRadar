# P004 Acquisition Log — Singer-Vine interactive claim-to-evidence artifact

Acquisition date: 2026-09-07
Decisive unknown: whether Jeremy Singer-Vine translated the static
claim-evidence architecture (as documented in the BuzzFeed News investigation
context) into an interactive surface navigated by a non-author evaluating
consequential AI output, **outside** that BuzzFeed context.

## Search infrastructure notes

- The general web search backend was unavailable for the full session
  (authentication failure on the search API: `403 Access denied`).
- All retrieval proceeded through `WebFetch` against targeted URLs.
  Multiple third-party search engines (Google, Bing, DuckDuckGo) returned
  redirects, captchas, or 429 rate limits during the session.
- GitHub CLI was not authenticated in the environment, so no
  `gh search` queries could be run.
- `web.archive.org` was unreachable from the retrieval environment.
- Personal site `jeremysv.com` was unreachable on every fetch attempt
  (socket closed); archived snapshots were unavailable.
- No contact with the person was made, per the frozen plan.

## Queries / search paths attempted

1. `WebFetch` on `https://jeremysv.com` — socket closed.
2. `WebFetch` on `https://jeremysv.com/work` — socket closed.
3. `WebFetch` on `https://github.com/jershi/` — username exists; profile
   shows "no public repositories".
4. `WebFetch` on `https://github.com/jeremysv?tab=repositories` — only one
   public repository: a 2017 fork of `home-assistant/home-assistant.io`
   (a Jekyll documentation site, not an interactive claim-to-evidence
   system).
5. `WebFetch` on `https://github.com/jeremysv` — confirms 1 repo, the
   same home-assistant fork, last touched 2017-10-20.
6. `WebFetch` on `https://github.com/search?q=author%3Ajeremysv&type=commits`
   — "0 results". No public commit history attributable to that account
   in indexed search.
7. `WebFetch` on `https://github.com/orgs/buzzfeednews/people?query=jeremysv`
   — "We couldn't find any matching members." `jeremysv` is not listed
   as a public member of the BuzzFeedNews organization.
8. `WebFetch` on `https://github.com/buzzfeednews/everything` — the
   curated index of BuzzFeed News open-source work. The catalog contains
   data parsers (`twick`, `bikeshares`, `namestand`, `whtranscripts`),
   investigation-specific analysis repos, and standardized datasets.
   **No shipped interactive product, AI-output surface, or
   claim-to-evidence tool is indexed there.**
9. `WebFetch` on `https://github.com/orgs/buzzfeednews/repositories` —
   116 repositories across the org; first page reviewed covers
   investigations, libraries, and datasets. **No interactive
   claim-to-evidence product appears in the first page** of the public
   org catalog.
10. `WebFetch` on `https://idyll-lang.org/` — Idyll is described as "a
    markup language for interactive documents." The homepage credits the
    Interactive Data Lab at the University of Washington, O'Reilly Media,
    Rhizome, and The Eutopia Foundation. **No mention of Singer-Vine**
    anywhere on the homepage.
11. `WebFetch` on `https://github.com/idyll-lang/idyll` — the README
    credits **Matt Conlen** and **Jeffrey Heer** (academic citation
    authors). **No mention of Singer-Vine** in the README.
12. `WebFetch` on
    `https://github.com/idyll-lang/idyll/graphs/contributors` — the
    contributors graph loaded as "Crunching the latest data…"; no
    contributor usernames could be extracted from the rendered page.
13. `WebFetch` on
    `https://github.com/idyll-lang/idyll/graphs/contributors-data` —
    HTTP 400, contributor data not returned.
14. `WebFetch` on `https://en.wikipedia.org/wiki/Idyll_(software)` —
    HTTP 404 (no such article).
15. `WebFetch` on `https://en.wikipedia.org/wiki/Idyll` — returns the
    literary/musical concept article, not the software project. **No
    mention of Singer-Vine, Conlen, or Heer.**
16. `WebFetch` on `https://www.npmjs.com/package/idyll` — HTTP 403.
17. `WebFetch` on `https://idl.uw.edu/papers/idyll/` — socket closed.
18. `WebFetch` on `https://idl.uw.edu/papers/idyll/index.html` — socket
    closed.
19. `WebFetch` on `https://api.github.com/repos/idyll-lang/idyll/contributors`
    — HTTP 403, unauthenticated API.
20. `WebFetch` on `https://api.github.com/users/jeremysv` — HTTP 403,
    unauthenticated API.
21. `WebFetch` on
    `https://en.wikipedia.org/wiki/BuzzFeed_News` — describes the
    organization's history, editorial stance, and notable stories.
    **No interactive tool, product, or system is named**, and no
    attribution of any such artifact to Singer-Vine appears.
22. `WebFetch` on `https://www.buzzfeed.com/about` — leadership and
    company description; **no mention of Singer-Vine** on the public
    company page.
23. `WebFetch` on
    `https://www.buzzfeednews.com/feature/dataviz` — HTTP 404.
24. `WebFetch` on
    `https://www.buzzfeednews.com/article/jeremysinger-vine` — HTTP 404
    (likely the URL slug is no longer canonical).
25. `WebFetch` on `https://www.themarkup.org/about/staff` — HTTP 404.
26. `WebFetch` on `https://themarkup.org/about` — staff roster is
    linked but not rendered in the fetched content; **no mention of
    Singer-Vine** appears in the rendered portion.
27. `WebFetch` on `https://www.source.opennews.org/people/jeremy-singer-vine/`
    — socket closed.
28. `WebFetch` on `https://www.muckrack.com/jeremy-singer-vine` — HTTP
    404.
29. `WebFetch` on `https://www.crunchbase.com/person/jeremy-singer-vine`
    — HTTP 403.
30. `WebFetch` on
    `https://scholar.google.com/citations?user=jeremy+singer-vine` —
    redirected to a CAPTCHA / `sorry` page; could not be resolved.
31. `WebFetch` on `https://arxiv.org/abs/1904.12955` — the Idyll
    preprint is by a different author (Clayton McDonald) and is
    unrelated to the Idyll project.
32. `WebFetch` on `https://arxiv.org/pdf/1904.12955` — same paper; PDF
    could not be parsed in the retrieval environment.
33. `WebFetch` on
    `https://en.wikipedia.org/wiki/Explainable_AI` — surveyed for any
    named, shipped consumer artifact embodying the claim-to-evidence
    pattern. Names historical research systems (MYCIN, GUIDON, SOPHIE,
    PROTOS, DARPA XAI, the Glass-Box voice assistant). **None are
    attributed to Singer-Vine**, and none are journalism-adjacent
    interactive products in the sense of the acquisition requirement.
34. `WebFetch` on `https://github.com/buzzfeed/forge` — HTTP 404 (no such
    repo at that path).
35. `WebFetch` on
    `https://conferences.oreilly.com/data/ai-ca-2019.html` — redirected
    to a generic O'Reilly conferences index; no speaker list containing
    Singer-Vine could be confirmed.

## Plausible candidates inspected (with accept / reject reason)

| # | Candidate | Source of the candidate | Accept / Reject | Reason |
|---|---|---|---|---|
| C1 | Idyll (`idyll-lang.org`, `github.com/idyll-lang/idyll`) — interactive-document markup language | Conjectural match to the "interactive claim-to-evidence" pattern; Idyll produces explorable documents with embedded computation | **Reject** | Idyll is publicly attributed to **Matt Conlen** and **Jeffrey Heer** at the University of Washington's Interactive Data Lab. Singer-Vine is not named on the Idyll homepage, the GitHub README, or in the academic citation. No public source retrieved in this pass names him as a creator, maintainer, or significant contributor. Attribution link is unsupported. |
| C2 | `jeremysv` GitHub personal account | First-party primary candidate | **Reject** | The account exposes only one public repo: a 2017 fork of the Home Assistant documentation site (a Jekyll static site, not an interactive claim-to-evidence system). No committed public work in the indexed commit history (`author:jeremysv` search returned 0 results). Account is also not a public member of the BuzzFeedNews organization. |
| C3 | BuzzFeed News GitHub organization catalog | First-party organizational index, includes 116 repos | **Reject** | The catalog contains parsers, datasets, and investigation-specific analysis repos. **No shipped interactive product, AI-output surface, or claim-to-evidence system is indexed.** The BuzzFeed context is also out of scope per the frozen plan. |
| C4 | Personal site `jeremysv.com` | First-party primary candidate | **Inconclusive** | The site was unreachable on every fetch attempt during the session (socket closed). No archived snapshot was available through the retrieval environment. Could not be inspected in this pass. |
| C5 | Personal site `jeremysv.com/work` | First-party primary candidate | **Inconclusive** | Same as C4 — unreachable. |
| C6 | The Markup staff page | Plausible current employer context (Singer-Vine has been reported in that ecosystem) | **Inconclusive** | The fetched page did not render the staff roster; no mention of Singer-Vine was observed in the rendered portion. Cannot be confirmed as a candidate or non-candidate. |
| C7 | Wikipedia article on Jeremy Singer-Vine | First-party biographical reference | **Reject** | No Wikipedia article exists at that title (HTTP 404). |
| C8 | Wikipedia article on Idyll (software) | First-party product reference | **Reject** | No such article exists (HTTP 404). The disambiguation lander returns the literary concept, which does not name any individual. |
| C9 | Explainable AI / "glass-box" systems surveyed via Wikipedia | Conjectural match to the "consequential AI output" pattern | **Reject** | None of the named systems (MYCIN, GUIDON, SOPHIE, PROTOS, DARPA XAI outputs, the Glass-Box voice assistant) are attributed to Singer-Vine in the retrieved source. Out of scope by the boundary ("not a journalism-adjacent interactive product built by the person") and by attribution. |
| C10 | Muckrack / Crunchbase / Source Open News staff pages | Standard professional-biosphere tertiary sources for journalists | **Inconclusive** | All three returned 403/404 or socket-closed during the session; no information could be extracted. |
| C11 | arXiv / IDL publication list (Idyll paper) | First-party academic authorship reference | **Inconclusive** | The arXiv preprint at the searched ID was an unrelated work. The IDL papers index and the Idyll paper HTML were both unreachable (socket closed). Could not confirm or deny Singer-Vine's authorship of the Idyll paper. |

## Out-of-scope candidates noted only for completeness

- The BuzzFeed News investigation work referenced in the frozen plan is
  explicitly out of scope and was not pursued.

## Summary of the gap

Across the inspected surface, the only public code attributable to
Singer-Vine via a primary account is one 2017 fork of a documentation
site, and the strongest external candidate matching the *functional*
pattern (Idyll) is not attributed to him in any source retrievable in
this session. No shipped interactive artifact, no product surface, and
no first-party project page emerged that satisfies the evidence
standard's attribution requirement.

**Acquisition route terminates as unresolved**, consistent with the
frozen plan's contingency for the case where no attributable
interactive artifact is publicly identifiable.
