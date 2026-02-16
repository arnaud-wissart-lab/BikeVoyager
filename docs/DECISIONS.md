# Registre de decisions (ADR)

## Objectif
Tracer les decisions techniques importantes, leur contexte et leurs consequences.

## Quand creer un ADR
- Changement d'architecture ou de convention transverse.
- Choix technique avec impact long terme (maintenance, securite, cout, performance).
- Abandon ou remplacement d'une decision precedente.

## Statuts utilises
- `Propose`
- `Accepte`
- `Remplace`
- `Abandonne`

## Template ADR court
```md
# ADR-000X - Titre court

- Date : YYYY-MM-DD
- Statut : Propose | Accepte | Remplace | Abandonne
- Portee : backend | frontend | infra | transverse
- References : PR / issue / document

## Contexte
Contexte factuel et probleme a resoudre.

## Decision
Decision retenue et perimetre exact.

## Consequences
- Positives :
- Negatives :
- Suivi necessaire :

## Alternatives evaluees
1. Option A - pourquoi non retenue
2. Option B - pourquoi non retenue
```

## Index ADR
- Historique initial : `DECISIONS.md` (racine du depot)
- Nouveaux ADR : a ajouter ici au fil de l'eau
