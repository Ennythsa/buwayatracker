/*
 * Buwaya Tracker
 * Compile: gcc -Wall -Wextra -o buwaya_tracker buwaya_tracker.c
 * Data file format (one politician per line, fields separated by "|"):
 *   id|name|party|position|platform|track_record
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <limits.h>

/* ===================================================================== */
/* 1. DATA STRUCTURES AND GLOBAL CONSTANTS                               */
/* ===================================================================== */
#define MAX_CANDIDATES 100
#define LINE_SIZE      1024
#define DATA_FILE      "data/politicians.txt"
#define REPORT_FILE    "Voter_Summary_Report.txt"

/* Where the shared data lives online. The program downloads this file at
 * startup and keeps a local copy (DATA_FILE) for when there is no internet. */
#ifndef DATA_URL
#define DATA_URL "https://ariehaku.github.io/bububububub/data/politicians.txt"
#endif
#define TEMP_FILE "data/politicians.tmp"

#ifdef _WIN32
#define NULL_DEV  "nul"
#define MKDIR_CMD "mkdir data >nul 2>&1"
#else
#define NULL_DEV  "/dev/null"
#define MKDIR_CMD "mkdir -p data >/dev/null 2>&1"
#endif

typedef struct {
    int  id;
    char name[100];
    char party[50];
    char position[50];
    char platform[300];
    char track_record[300];
} Politician;

/* ===================================================================== */
/* HELPER FUNCTIONS                                                      */
/* ===================================================================== */

/* Safe copy: always null-terminates and never overflows dest. */
static void copyString(char *dest, size_t destSize, const char *src)
{
    snprintf(dest, destSize, "%s", src);
}

/* Reads one line from the keyboard, strips the newline.
 * Returns 1 on success, 0 on end of input. */
static int readLine(char *buf, size_t size)
{
    if (fgets(buf, (int)size, stdin) == NULL)
        return 0;

    if (strchr(buf, '\n') == NULL) {
        /* Line was longer than the buffer: discard the rest of it. */
        int c;
        while ((c = getchar()) != '\n' && c != EOF)
            ;
    }
    buf[strcspn(buf, "\r\n")] = '\0';
    return 1;
}

/* Converts text to an int. Returns 1 if the whole string is a valid number. */
static int parseInt(const char *s, int *out)
{
    char *end;
    long value;

    if (s == NULL || *s == '\0')
        return 0;

    value = strtol(s, &end, 10);
    if (end == s)
        return 0;
    while (isspace((unsigned char)*end))
        end++;
    if (*end != '\0')
        return 0;
    if (value < INT_MIN || value > INT_MAX)
        return 0;

    *out = (int)value;
    return 1;
}

/* Prompts for an integer. Returns 1 on success, 0 if input was not a number. */
static int promptInt(const char *prompt, int *out)
{
    char buf[LINE_SIZE];

    printf("%s", prompt);
    if (!readLine(buf, sizeof buf))
        return 0;
    return parseInt(buf, out);
}

/* Case-insensitive "is needle inside haystack?" */
static int containsIgnoreCase(const char *haystack, const char *needle)
{
    size_t hLen = strlen(haystack);
    size_t nLen = strlen(needle);
    size_t i, j;

    if (nLen == 0)
        return 1;
    if (nLen > hLen)
        return 0;

    for (i = 0; i + nLen <= hLen; i++) {
        for (j = 0; j < nLen; j++) {
            if (tolower((unsigned char)haystack[i + j]) !=
                tolower((unsigned char)needle[j]))
                break;
        }
        if (j == nLen)
            return 1;
    }
    return 0;
}

/* Extracts the text up to the next "|" into dest and moves the cursor
 * past the delimiter. If there is no "|", takes the remaining string. */
static void nextToken(char **cursor, char *dest, size_t destSize)
{
    char *start = *cursor;
    char *bar   = strchr(start, '|');

    if (bar != NULL) {
        *bar    = '\0';
        *cursor = bar + 1;
    } else {
        *cursor = start + strlen(start);
    }
    copyString(dest, destSize, start);
}

/* ===================================================================== */
/* 3. SUB-FUNCTIONS (MODULES)                                            */
/* ===================================================================== */

/* Returns 1 if the file has at least one line that looks like a record
 * (starts with a number and contains a "|"). Rejects error pages. */
static int looksValid(const char *path)
{
    FILE *fp = fopen(path, "r");
    char line[LINE_SIZE];
    int ok = 0;

    if (fp == NULL)
        return 0;
    while (fgets(line, sizeof line, fp) != NULL) {
        if (isdigit((unsigned char)line[0]) && strchr(line, '|') != NULL) {
            ok = 1;
            break;
        }
    }
    fclose(fp);
    return ok;
}

/* Downloads the latest data from GitHub into the local copy.
 * If there is no internet (or the download is bad), the existing local
 * copy is left untouched and used instead. Needs the "curl" command,
 * which comes with Windows 10+, macOS and most Linux systems. */
void syncFromGitHub(void)
{
    char cmd[512];
    int rc;

    printf("Checking GitHub for updates...\n");

    rc = system(MKDIR_CMD);                 /* make sure data/ exists */
    (void)rc;

    snprintf(cmd, sizeof cmd,
             "curl -fsSL --connect-timeout 5 --max-time 15 "
             "-H \"Cache-Control: no-cache\" -o \"%s\" \"%s\" >%s 2>&1",
             TEMP_FILE, DATA_URL, NULL_DEV);
    rc = system(cmd);

    if (rc == 0 && looksValid(TEMP_FILE)) {
        int ok = (rename(TEMP_FILE, DATA_FILE) == 0);
        if (!ok) {                          /* Windows can't overwrite on rename */
            remove(DATA_FILE);
            ok = (rename(TEMP_FILE, DATA_FILE) == 0);
        }
        if (ok)
            printf("Data updated from GitHub.\n");
        else
            printf("Could not save the update. Using the existing local copy.\n");
    } else {
        remove(TEMP_FILE);
        printf("Offline or GitHub unreachable. Using the saved local copy.\n");
    }
}

void loadDatabase(Politician list[], int *candidateCount)
{
    FILE *fp = fopen(DATA_FILE, "r");
    char line[LINE_SIZE];

    if (fp == NULL)
        return;

    *candidateCount = 0;

    while (*candidateCount < MAX_CANDIDATES && fgets(line, sizeof line, fp) != NULL) {
        char  idToken[32];
        char *cursor;
        int   id;
        Politician *p;

        line[strcspn(line, "\r\n")] = '\0';
        if (line[0] == '\0')
            continue;                       /* skip blank lines */

        cursor = line;
        nextToken(&cursor, idToken, sizeof idToken);
        if (!parseInt(idToken, &id))
            continue;                       /* skip malformed lines */

        p = &list[*candidateCount];
        p->id = id;
        nextToken(&cursor, p->name,     sizeof p->name);
        nextToken(&cursor, p->party,    sizeof p->party);
        nextToken(&cursor, p->position, sizeof p->position);
        nextToken(&cursor, p->platform, sizeof p->platform);
        copyString(p->track_record, sizeof p->track_record, cursor);

        (*candidateCount)++;
    }

    fclose(fp);
}

void saveDatabase(const Politician list[], int candidateCount)
{
    FILE *fp = fopen(DATA_FILE, "w");
    int i;

    if (fp == NULL) {
        printf("Error saving database.\n");
        return;
    }

    for (i = 0; i < candidateCount; i++) {
        fprintf(fp, "%d|%s|%s|%s|%s|%s\n",
                list[i].id,
                list[i].name,
                list[i].party,
                list[i].position,
                list[i].platform,
                list[i].track_record);
    }

    fclose(fp);
}

void searchPoliticians(const Politician list[], int candidateCount)
{
    char keyword[100];
    int  found = 0;
    int  i;

    printf("Enter name or keyword to search: ");
    if (!readLine(keyword, sizeof keyword))
        return;

    printf("--- Search Results ---\n");

    for (i = 0; i < candidateCount; i++) {
        if (containsIgnoreCase(list[i].name, keyword) ||
            containsIgnoreCase(list[i].platform, keyword)) {

            printf("ID: %d | Name: %s\n", list[i].id, list[i].name);
            printf("Party: %s | Position: %s\n", list[i].party, list[i].position);
            printf("Platform: %s\n", list[i].platform);
            printf("------------------------\n");
            found = 1;
        }
    }

    if (!found)
        printf("No matching records found.\n");
}

void comparePoliticians(const Politician list[], int candidateCount)
{
    int id1, id2;
    int index1 = -1, index2 = -1;
    int i;

    if (!promptInt("Enter ID of first politician: ", &id1) ||
        !promptInt("Enter ID of second politician: ", &id2)) {
        printf("Invalid input! IDs must be numbers.\n");
        return;
    }

    for (i = 0; i < candidateCount; i++) {
        if (list[i].id == id1) index1 = i;
        if (list[i].id == id2) index2 = i;
    }

    if (index1 == -1 || index2 == -1) {
        printf("One or both IDs were not found.\n");
        return;
    }

    printf("=== COMPARISON ===\n");
    printf("%s | %s\n", list[index1].name, list[index2].name);
    printf("-------------------------------------------\n");
    printf("Party: %s | %s\n",    list[index1].party,    list[index2].party);
    printf("Position: %s | %s\n", list[index1].position, list[index2].position);
    printf("Platform: %s | %s\n", list[index1].platform, list[index2].platform);
}

void editPolitician(Politician list[], int candidateCount)
{
    int  targetID;
    int  found = 0;
    char newPlatform[LINE_SIZE];
    int  i;

    if (!promptInt("Enter ID of politician to edit: ", &targetID)) {
        printf("Invalid input! ID must be a number.\n");
        return;
    }

    for (i = 0; i < candidateCount; i++) {
        if (list[i].id == targetID) {
            char *bar;

            found = 1;
            printf("Current Platform: %s\n", list[i].platform);
            printf("Enter new Platform summary: ");
            if (!readLine(newPlatform, sizeof newPlatform))
                return;

            /* "|" is the file delimiter, so it can't appear inside a field. */
            while ((bar = strchr(newPlatform, '|')) != NULL)
                *bar = '-';

            /* Safe string copy (limited to the field size, 300 chars) */
            copyString(list[i].platform, sizeof list[i].platform, newPlatform);

            printf("Record updated successfully.\n");
            break;
        }
    }

    if (!found)
        printf("Candidate ID not found.\n");
}

void exportSummary(const Politician list[], int candidateCount)
{
    FILE *fp = fopen(REPORT_FILE, "w");
    int i;

    if (fp == NULL) {
        printf("Error creating report file.\n");
        return;
    }

    fprintf(fp, "=========================================\n");
    fprintf(fp, "      BUWAYA TRACKER CANDIDATE SUMMARY   \n");
    fprintf(fp, "=========================================\n");
    fprintf(fp, "\n");

    for (i = 0; i < candidateCount; i++) {
        fprintf(fp, "ID: %d\n",            list[i].id);
        fprintf(fp, "Name: %s\n",          list[i].name);
        fprintf(fp, "Party: %s\n",         list[i].party);
        fprintf(fp, "Position: %s\n",      list[i].position);
        fprintf(fp, "Platform: %s\n",      list[i].platform);
        fprintf(fp, "Track Record: %s\n",  list[i].track_record);
        fprintf(fp, "-----------------------------------------\n");
    }

    fclose(fp);
    printf("Report successfully exported to '%s'!\n", REPORT_FILE);
}

/* ===================================================================== */
/* 2. MAIN PROGRAM FLOW                                                  */
/* ===================================================================== */

int main(void)
{
    static Politician PoliticianList[MAX_CANDIDATES];
    int  candidateCount = 0;
    int  choice = 0;
    char inputString[LINE_SIZE];

    /* Get the latest data from GitHub (falls back to the local copy) */
    syncFromGitHub();

    /* Load initial data from local text file */
    loadDatabase(PoliticianList, &candidateCount);

    if (candidateCount == 0)
        printf("Warning: No records found. Ensure '%s' exists.\n", DATA_FILE);

    /* Main Menu Loop */
    while (choice != 5) {

        printf("\n=========================================\n");
        printf("          BUWAYA TRACKER MENU            \n");
        printf("=========================================\n");
        printf("1. Search & Filter Politicians\n");
        printf("2. Compare Two Politicians\n");
        printf("3. Edit Politician Record\n");
        printf("4. Export Summary Report\n");
        printf("5. Exit\n");
        printf("=========================================\n");
        printf("Enter choice (1-5): ");

        /* --- INPUT VALIDATION --- */
        if (!readLine(inputString, sizeof inputString)) {
            /* Input stream closed: save and exit instead of looping forever. */
            printf("\nSaving data...\n");
            saveDatabase(PoliticianList, candidateCount);
            printf("Exiting Buwaya Tracker. Remember to vote wisely!\n");
            break;
        }

        if (!parseInt(inputString, &choice)) {
            printf("Invalid input! Please enter a number.\n");
            choice = 0;                     /* Force loop to repeat */
        } else if (choice < 1 || choice > 5) {
            printf("Out of range! Please select 1 to 5.\n");
        } else {
            /* --- PROCESS USER CHOICE --- */
            switch (choice) {
                case 1:
                    searchPoliticians(PoliticianList, candidateCount);
                    break;
                case 2:
                    comparePoliticians(PoliticianList, candidateCount);
                    break;
                case 3:
                    editPolitician(PoliticianList, candidateCount);
                    break;
                case 4:
                    exportSummary(PoliticianList, candidateCount);
                    break;
                case 5:
                    printf("Saving data...\n");
                    saveDatabase(PoliticianList, candidateCount);
                    printf("Exiting Buwaya Tracker. Remember to vote wisely!\n");
                    break;
            }
        }
    }

    return 0;
}
