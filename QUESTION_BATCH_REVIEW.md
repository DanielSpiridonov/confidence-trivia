# Additional question batch

The server imports 145 English/Bulgarian records from `packages/server/src/content/additionalQuestions.ts`: 49, 49, and 47 from three submitted batches. IDs from the submitted batches are preserved. Answer keys remain server-only. The bank originally contained 188 questions and now contains 333.

## Editorial decisions

- Omitted `new_tf_004`: repeats the Berlin Wall fact in `new_closest_002`.
- `new_mc_005`: use the original English acronym expansions in Bulgarian options so the CPU question tests the same thing in both languages.
- `new_mc_010`: say "peace settlement" rather than a single treaty for the Peace of Westphalia.
- `new_tf_005`: distinguish Neptune's identification as a planet in 1846 from earlier telescope sightings.
- `new_estimate_004`: specify a typical nucleated somatic cell; some human cells have no nucleus.
- `new_estimate_006`: move the kibibyte question into Technology.
- `new_closest_001`: replace ambiguous height excluding antennas with the explicitly dated 2022 height including antennas, 330 metres.
- `new_closest_003`: scope the whale measurement to Guinness's 1909 record, 33.57 metres, which rounds to **34**, not 33.
- `new_ordering_002`: specify European historical periods.
- `new_word_007`: accept common Bulgarian singular/plural and definite forms.
- Retain the submitted arithmetic questions, including Earth's orbital speed divided by five (29.78 / 5 rounds to 6) and the scaled Avogadro constant (6.02214076 × 10²³ / 10²⁰ rounds to 6022).

Space and Literature have localized labels and are available through the normal Custom category selector. No temporary test mode or solo-start bypass is added.

## Specific references checked during review

These links are separate editorial references, not fields in the question records. The original submitted homepage links do not constitute question-specific verification. This list documents targeted checks; it does not claim that every supplied homepage or every fact was individually verified online.

| Question ID | Reference | Relevant fact |
| --- | --- | --- |
| `new_mc_005` | [IBM: central processing unit](https://www.ibm.com/think/topics/central-processing-unit) | CPU expansion |
| `new_mc_007` | [Roland-Garros stadium](https://stade.rolandgarros.com/en/stadium) | Clay Grand Slam |
| `new_mc_008` | [NASA: Titan facts](https://science.nasa.gov/saturn/moons/titan/facts/) | Nitrogen-dominated atmosphere |
| `new_mc_009` | [CERN: fundamental forces](https://cds.cern.ch/record/2905272/files/3_Passport_Fundamental-forces.pdf) | Electromagnetic mediator: photon |
| `new_tf_005` | [NASA: Neptune](https://science.nasa.gov/neptune/) | Earlier sightings and later planetary discovery |
| `new_estimate_004` | [NHGRI: chromosomes](https://www.genome.gov/about-genomics/fact-sheets/Chromosome-Abnormalities-Fact-Sheet) | Typical human chromosome count 46 |
| `new_estimate_005` | [R&A: playing the round](https://www.randa.org/en/rog/the-rules-of-golf/rule-5) | A round can be 18 or fewer holes; question specifies standard full round |
| `new_estimate_006`, `new_ordering_005` | [NIST: binary and decimal prefixes](https://pml.nist.gov/cuu/Units/binary.html) | Kibibyte 1024 bytes; ordering of unit prefixes |
| `new_estimate_008` | [NIST: temperature conversions](https://www.nist.gov/system/files/documents/2019/11/05/appc-20-hb44_final.pdf) | Celsius + 273.15 = kelvin |
| `new_closest_001` | [Eiffel Tower: height history](https://www.toureiffel.paris/en/news/history-and-culture/300-330-meters-story-towers-height) | 330 metres following 2022 antenna installation |
| `new_closest_003` | [Guinness: largest whale](https://www.guinnessworldrecords.com/world-records/69467-largest-whale) | Documented 1909 measurement 33.57 metres |
| `new_closest_005` | [NASA: Mars facts](https://science.nasa.gov/mars/facts/) | Orbital period about 687 Earth days |
| `new_closest_006` | [NASA: orbital parameters](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | Earth's mean orbital velocity 29.78 km/s |
| `new_closest_007` | [Guinness: highest waterfall](https://www.guinnessworldrecords.com/world-records/highest-waterfall) | Angel Falls total height 979 metres |
| `new_closest_008` | [NIST: SI constants](https://www.nist.gov/si-redefinition/meet-constants) | Exact Avogadro constant |
| `new_word_005` | [Python: general FAQ](https://docs.python.org/3/faq/general.html) | Guido van Rossum; Monty Python naming |

The deck/gross/factorial questions are directly checkable arithmetic: 4 × 13 = 52; 12 × 12 = 144; 7! = 5040. Existing bank validation checks IDs, bilingual records, option indices, ordering permutations, and difficulty points; it cannot establish factual accuracy.

## Second batch

Added 49 of the 50 submitted records (`new_mc_011` through the corresponding `016`/`020` series). The accompanying partial continuation overlaps the complete submission and is not a separate batch.

- Corrected `new_tf_016` to true: the Rosetta Stone was discovered in 1799, which is in the eighteenth century.
- Corrected `new_closest_015` from 6961 to the submitted conventional Nile length of 6650 km. Removed the number from both prompts so they do not reveal the answer. River lengths vary by measurement convention; this is an approximate reference value, not a claim of an exact surveyed length.
- Omitted `new_ordering_010`: villages, cities, continents, and planets do not form an unambiguous ordering by "typical scale". The supplied key was also inconsistent with its intended ordering.
- Removed the years from `new_ordering_014` options, and distinguished the relevant release/launch milestones from invention dates. The order remains IBM PC (1981), public Web release (1991), Bluetooth 1.0 (1999), Bitcoin launch (2009).
- Specified diameter for `new_tf_013`: Ganymede is wider than Mercury but less massive.
- Specified full starting lineups for football and rugby union, avoiding confusion with minimum permitted player counts and dismissals.

### Targeted references for the second batch

| Question ID | Reference | Relevant fact |
| --- | --- | --- |
| `new_mc_018` | [Oracle: brief history of Java](https://education.oracle.com/file/general/4955_BriefHistoryOfJava_7.pdf) | Developed at Sun Microsystems |
| `new_tf_013` | [NASA: satellite comparison](https://nssdc.gsfc.nasa.gov/planetary/factsheet/galileanfact_table.html) | Ganymede diameter versus Mercury |
| `new_tf_014` | [Apple: first iPhone release](https://www.apple.com/newsroom/2007/06/28iPhone-Premieres-This-Friday-Night-at-Apple-Retail-Stores/) | June 2007, not 2005 |
| `new_tf_016` | [British Museum: Rosetta Stone guide](https://www.britishmuseum.org/sites/default/files/2022-10/Hieroglyphs_unlocking_ancient_Egypt_large_print_guide_The_British_Museum.pdf) | Discovery in July 1799 |
| `new_closest_013`, `new_ordering_013` | [NASA: planetary fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) | Equatorial diameter rounds to 143000 km; planetary diameter ordering |
| `new_closest_015` | [NavShip: Nile](https://waterways.navship.org/infos/Nil/en/) | Conventional total length 6650 km |
| `new_closest_016` | [BIPM: standard atmosphere](https://www.bipm.org/en/committees/cg/cgpm/10-1954/resolution-4) | 101325 pascals |
| `new_ordering_014` | [IBM PC history](https://www.ibm.com/history/personal-computer), [CERN contemporary history](https://cds.cern.ch/record/321530/files/open-97-005.pdf), [Intel Bluetooth 1.0 release](https://www.intel.com/pressroom/archive/releases/1999/Mp072699.htm) | 1981, 1991, and 1999 milestones |

Direct arithmetic checks include 2¹² = 4096 and uranium-238 neutron count 238 − 92 = 146. As with the first batch, these references document targeted checks, not independent online verification of every fact in the batch.

## Third batch

Added 47 records, with English/Bulgarian wording and answer aliases preserved or clarified.

- Omitted `new_estimate_018` (contrived arithmetic) and `new_closest_018` (answer in prompt), as requested in the submitted quality note.
- Omitted `new_closest_023`: the Dead Sea depth needs a dated measurement and identifiable reference before using 371 metres as a scoring target.
- `new_closest_019`: specify the September 2023 Mont Blanc survey, 4805.59 metres rounded to 4806. The snow summit changes; the supplied undated 4808 is not used.
- `new_ordering_023`: remove exposed years and replace disputed imperial "founding" conventions with specific historical milestones: Cyrus establishes the Achaemenid Empire, Augustus becomes emperor, Constantine dedicates Constantinople, Genghis Khan establishes the Mongol Empire.
- `new_ordering_024`: remove years from options and ask about first appearance, avoiding an exact "first release" convention for C.
- `new_ordering_022`: specify longwave radio to distinguish it from microwaves, which are part of the broader radio spectrum.
- Clarify full basketball lineup, individual chessboard squares, and twelve-tone equal temperament.
- Accept specific African elephant answers and Bulgarian plural definite ribosome answers.

### Targeted references for the third batch

| Question ID | Reference | Relevant fact |
| --- | --- | --- |
| `new_tf_022` | [Linux Foundation kernel history](https://project.linuxfoundation.org/hubfs/Reports/2020_kernel_history_report_082720.pdf) | First kernel release in 1991 |
| `new_closest_019` | [Chamonix: September 2023 survey](https://www.chamonix.net/index.php/english/news/mont-blanc-has-lost-more-2-meters-two-years-current-height-480559-meters) | 4805.59 metres |
| `new_closest_021` | [NASA: Moon questions](https://science.nasa.gov/moon/top-moon-questions/) | Sidereal orbit 27.3 days, distinct from 29.5-day phase cycle |
| `new_closest_022` | [NASA: Sun facts](https://science.nasa.gov/sun/facts/) | Approximate photosphere temperature 5500 degrees Celsius |
| `new_ordering_024` | [Ritchie: C history](https://www.nokia.com/bell-labs/about/dennis-m-ritchie/chist.html), [Go public release](https://go.dev/solutions/google/) | C in early 1970s; Go public in 2009 |

Arithmetic check: 9! = 362880. These references document targeted checks rather than individual live verification of every submitted fact.
