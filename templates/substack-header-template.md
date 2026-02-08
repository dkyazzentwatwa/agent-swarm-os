# Substack Article Template

## Header Block

```markdown
# {{TITLE — compelling, keyword-rich, under 80 characters}}

*{{SUBTITLE — complements the title, adds context or a promise}}*

**{{ESTIMATED_READING_TIME}} min read** · {{CONTENT_PILLAR}} · {{PUBLISH_DATE}}
```

## Article Structure

### Opening (200-300 words)
```markdown
{{STORY, SURPRISING STAT, or CONTRARIAN TAKE}}

Open with something specific and concrete. Not "AI is changing everything"
but "Last Tuesday, I fed 127,000 tokens into a single prompt and watched
the model do something I'd never seen before."

The reader should be hooked before they realize what the article is about.
```

### Section 1: The Context (300-500 words)
```markdown
## {{SECTION HEADER — clear, descriptive}}

{{WHY THIS MATTERS — establish the problem, the gap, or the change}}

> "{{PULLQUOTE — the single most important sentence in this section}}"

{{EVIDENCE, EXAMPLES, or DATA to support the setup}}
```

### Section 2: The Deep Dive (500-800 words)
```markdown
## {{SECTION HEADER}}

{{CORE ARGUMENT or ANALYSIS — this is the meat of the article}}

{{CODE BLOCK if relevant:}}
```{{LANGUAGE}}
// Well-commented code, under 30 lines
// Highlight the key lines with comments
{{CODE}}
```

{{EXPLANATION of what the code/data/analysis shows}}

> "{{PULLQUOTE — a key insight from this section}}"
```

### Section 3: Implications (300-500 words)
```markdown
## {{SECTION HEADER — "What This Means" or "So What?"}}

{{PRACTICAL TAKEAWAYS — what should the reader DO differently?}}

{{NUMBERED LIST of actionable recommendations if applicable:}}
1. {{ACTIONABLE POINT}}
2. {{ACTIONABLE POINT}}
3. {{ACTIONABLE POINT}}
```

### Section 4: Looking Forward (200-300 words)
```markdown
## {{SECTION HEADER — "What's Next" or "Open Questions"}}

{{PREDICTIONS, OPEN QUESTIONS, or AREAS TO WATCH}}

{{End with a question that invites the reader to think, not just consume}}
```

### Sign-Off
```markdown
---

*{{PERSONAL NOTE — 1-2 sentences. Conversational, direct. Example: "I've been
thinking about this all week and I'm still not sure I've got it right.
Hit reply and tell me what I'm missing.}}*

*If you found this useful, share it with someone who's grappling with
{{TOPIC}}. And if you're not subscribed yet — I publish every {{PUBLISH_DAY}}.*
```

## Footnotes
```markdown
[^1]: {{SOURCE — URL, paper title, or attribution}}
[^2]: {{SOURCE}}
```

## Metadata (metadata.json)
```json
{
  "title": "{{TITLE}}",
  "subtitle": "{{SUBTITLE}}",
  "tags": ["{{TAG_1}}", "{{TAG_2}}", "{{TAG_3}}"],
  "category": "{{CONTENT_PILLAR}}",
  "estimatedReadingTime": "{{N}} min read",
  "publishDate": "{{YYYY-MM-DD}}"
}
```

## Substack Notes Version
```markdown
{{2-3 paragraphs capturing the core insight}}

{{The hook should drive clicks to the full article without feeling like clickbait}}

[Read the full deep dive →]({{ARTICLE_URL}})
```

## Quality Checklist

- [ ] Opens with story/stat/contrarian take (not "In this article...")
- [ ] Clear H2 sections every 300-500 words
- [ ] At least 2 pullquotes
- [ ] Code blocks have language tags and comments
- [ ] Sources cited in footnotes
- [ ] Personal sign-off at end
- [ ] Notes version captures core insight in 2-3 paragraphs
- [ ] metadata.json is complete
- [ ] Reading time estimate is accurate
