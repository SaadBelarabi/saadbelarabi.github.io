---
layout: post
title:  "Cyberdefenders Write-up | AzurePot"
date:   2026-01-23 17:51:03 +0100
categories: jekyll update
---

<link rel="stylesheet" href="{{ '/assets/css/image-zoom.css' | relative_url }}">
<script src="{{ '/assets/js/image-zoom.js' | relative_url }}"></script>


# Scenario
This Ubuntu Linux honeypot was deployed in Azure in early October to monitor activities related to the exploitation of CVE-2021-41773.
Initially, the system attracted a significant number of cryptocurrency miners. To mitigate this, a cron script was implemented to remove files named "kinsing" in the /tmp directory. This action was taken to prevent these miners from interfering so that more interesting activities could be observed.

## What's the material we have?
After unzip and unfolding all the compressed and archived stuff that we had, we found ourselves with:
- **sdb.vhd-002**: Virtual Hard Disk (basically the same a Hard Drive/Physical Drive as it mimics it's job, having a file system and partitions. It's mainly used in VMs. Also it's portable so you can use it on a machine, do your thing, and use it in another machine.)
- A bunch of files that we'll regroup under the **'uac' directory**. From the scenario it seems to be the results of the User Access Control that's running in the system but it looks rather like the output of Unix-like artifacts collector.
- **ubuntu.20211208.mem**: A memory dump from the machine we are analyzing.

---

### Q1: There is a script that runs every minute to do cleanup. What is the name of the file?

Since it's mentioned in the question that the script runs every minute, we could easily assume it's running as a cronjob. Cron jobs are the equivalent of scheduled tasks in windows for linux. They are made to do certain actions in a periodic manner. 

**Info:** Even though it's not relevant to this question, cron jobs a common way to achieve persistence for attackers.

Cronjobs are commonly stored at `/var/spool/cron/crontabs`, so we'll look into that first.

![img](/images/image001.png)

We do find a file named "root" which is the cronjob file for the root user. We see that a file named `.remove.sh` located in the `/root` directory is running every minute.

![img](/images/image002.png)

By taking a look at the content of the script, we see commands that indicate processes with names starting with "kinsing" or "kdevtmp". We also see `chown` and `chmod` commands in an attempt to neutralize the impact of these files (we'll learn later that these files are cryptomining files), by changing the permissions to read-only and the ownership to the root user.

**Answer:** `.remove.sh`

<br>

---

<br>

### Q2: The script in Q1 terminates processes associated with two Bitcoin miner malware files. What is the name of 1st malware file?

Going back at the 1st question, we see that the processes that are being deleted are found in the `/tmp` directory. When we take a look at it, we see a bunch of files both still existing in the disk image and some deleted.

![img](/images/image003.png)

Most of the files are named kinsing and by looking at the headers we see that it's a large ELF file. ELF files in `/tmp` directory aren't usual so we can assume that kinsing file is one of the two Bitcoin miner malware files, and it ended up being the correct answer.

**Answer:** `kinsing`

<br>

---

<br>

### Q3: The script changes the permissions for some files. What is their new permission?

This is an easy one if we look back at our findings in Q1. The `.remove.sh` script does change the permissions of the file starting with a "k" to read-only for all, as 444 means the read permission for the owner, group and others.

**Answer:** `444`

<br>

---

<br>

### Q4: What is the SHA256 of the botnet agent file?

What's a botnet agent file first? From what I understood [here](https://www.malwarebytes.com/blog/threats/botnets "BotnetAgentArticle"){:target="_blank"} The botnet agent is the primary file that infects a machine before it becomes part of a botnet. Often it installs additional payload, or steal data, and keeps contact with the C2 server, which controls all the machines that are part of the botnet.

The problem here is, I didn't have much clue of where to look at. Going back to the scenario of the exercise we know that the webserver was made a honeypot to monitor activities related to **CVE-2021-41773**, which is a vulnerability in [Apache HTTP Server 2.4.49](https://httpd.apache.org/docs/current/en/howto/cgi.html "ApacheVulnArticle"){:target="_blank"}, to be more precise a path traversal that could lead to RCE (Remote Code Execution) if CGI scripts (Common Gateway Interface) are enabled. CGI scripts per the Apache HTTP Server documentation are defined as "The CGI (Common Gateway Interface) defines a way for a web server to interact with external content-generating programs, which are often referred to as CGI programs or CGI scripts."

![img](/images/image004.png)

So an idea that comes up is looking at the history of requests that have been made and see if we can find a pattern of requests similar to a path traversal. Apache `access_log` log file is where info about the requests that the webserver deals with is being stored. Since it's quite a heavy file, I used some basic linux commands to narrow down the results as much as I could. Here's the final command that I used:
```bash
cat access_log | grep "cgi" | grep " 200" | grep "bin/" | awk '{print $1}' | sort | uniq -c | sort -nr
```

**Explanation:**
- The grep on "cgi" is because in order to achieve RCE, you need in your crafted URL for path traversal to start with the `/cgi-bin` folder.
- The grep " 200" is to look for successful requests that return a 200 OK code message.
- Grep "bin/" that's looking for "bin/" strings because a shell binary is required to achieve RCE
- The awk command to print the first string of every line, which represents the IP address of the client.
- The first "sort" is to put the similar IPs together, otherwise the "uniq" command won't count correctly repeated addresses.
- The `uniq -c` to look for the IP addresses simply to see what IP addresses did the most requests.
- The 2nd "sort" is just for visual purposes to see easily what the most used addresses are.

These are the most used, based on our filter, with the number of occurrences on the left:

![img](/images/image005.png)

We can look at these IPs in `error_log` and see if we can find anything interesting. Luckily we do find some stuff when using the following command:
```bash
cat error_log | grep "141[.]135[.]85[.]36" | egrep "curl|wget"
```

![img](/images/image006.png)

The reason I looked for curl and wget keywords is because these are tools used for downloading content and likely to find in any linux distribution.

We find some suspicious strings like `chmod +x` and `./dk86 &` which are used to add execution permissions and run the program in the background. We see that the output file is stored in the `/tmp` directory even though nothing is found there after searching.

Unfortunately, I didn't have much idea of what to do afterwards, so I looked up the solution which mentioned an interesting idea. Apparently files in the `/tmp` folder are usually deleted after reboot so it's more safe for the attacker to move it somewhere else. The file is found in `/var/tmp` and has the same name as the one found earlier "dk86". Not much is left, we just need to extract the file with autopsy and calculate the hash with a command like `sha256sum`.

**Answer:** `0e574fd30e806fe4298b3cbccb8d1089454f42f52892f87554325cb352646049`

<br>

---

<br>

### Q5: What is the name of the botnet in Q4?

This also is a straight one. By searching for info about the hash we just found, using a tool like VirusTotal, we can see that it's indeed a suspicious file.

![img](/images/image007.png)

We also see the label Tsunami quite often, with some other names as well, and after a google search we find that Tsunami is indeed a known malware. It also ends up being the answer to the question.

**Answer:** `Tsunami`

<br>

---

<br>

### Q6: What IP address matches the creation timestamp of the botnet agent file in Q4?

By taking a look at the file metadata in autopsy, we can see the Created Time property, here in CET.

![img](/images/image008.png)

For the sake of having a clear image of the incident timeline, we'll convert it to whatever time zone the machine had. We can take a look at the `/etc/timezone` (for Ubuntu systems) where we have the time zone that's configured in the machine.

![img](/images/image009.png)

We can see the time zone used in the machine is UTC, which after a Google research is 1 hour behind CET.

The reason why I looked up for this info is because I thought if something was to be logged in the machine, it would utilize the time zone of the machine, thus the need to convert the Creation time we found to UTC. That means that the dk86 file was created at **2021-11-11 19:09:51 UTC**.

Looking at logs in `access_log` we don't find much info, but in `error_log` we do find some interesting things. Obviously if the creation of the file started at X time, the trigger for such action should happen before X, so we are looking for events before this timestamp.

![img](/images/image010.png)

We do find a log where the file dk86 is mentioned, and the client -- the machine that's sending the data -- is the one with IP `141[.]135[.]85[.]36`. We can be even more sure of the full processing of the request by looking at the timestamp of the following logs:

![img](/images/image011.png)

We can say that the IP is probably behind the download of that file.

**Answer:** `141[.]135[.]85[.]36`

<br>

---

<br>

### Q7: What URL did the attacker use to download the botnet agent?

We can easily determine the URL used from the previous image.

**Answer:** `http://138[.]197[.]206[.]223/wp-content/themes/twentysixteen/dk86`

<br>

---

<br>

### Q8: What is the name of the file that the attacker downloaded to execute the malicious script and subsequently remove itself?

I don't really see a logical way to find what we are looking for. In CyberDefenders official write-up it's mentioned that you can help yourself by reducing the noise, mainly by removing logs with client IPs that are related to benign services like google or Microsoft.

<br>

---

<br>

### Q9: The attacker downloaded SH scripts. What are the names of these files?

**WIP**

<br>

---

<br>

### Q10: Two suspicious processes were running from a deleted directory. What are their PIDs?

From the content that was provided to us, we can see a bunch of outputs from linux binaries, lsof and ps:

![img](/images/image012.png)

The `lsof` binary lists all the files that are/were opened by a process. In our case lsof is particularly interesting because we are looking for processes that were running from a deleted directory (keep in mind that in linux everything is considered a file, and so are directories).

From the [lsof documentation](https://lsof.readthedocs.io/en/latest/faq/#lsof-problems "lsofDocumentation"){:target="_blank"}:

![img](/images/image013.png)

![img](/images/image014.png)

We can see 2 processes here with the a file descriptor "cwd" which stands for Current Working Directory. This means that the processes were running from the same directory mentioned in the last column.

**Answer:** `6388,20645`

<br>

---

<br>

### Q11: What is the suspicious command line associated with the PID that ends with `45` in Q10?

Since we have the PID, we can look through the output of the ps binary and see what exact command started the process:

![img](/images/image015.png)

**Answer:** `sh .src.sh`

<br>

---

<br>

### Q12: UAC gathered some data from the second process in Q10. What is the remote IP address and remote port that was used in the attack?

A common place to look for data regarding a specific process is the `/proc` directory. Here you can find information about each process (children processes, file descriptor values of opened files ...). After a bit of digging, we find some suspicious values in the environment variables of that process.

![img](/images/image016.png)

**Answer:** `116[.]202[.]187[.]77:56590`

<br>

---

<br>

### Q13: Which user was responsible for executing the command in Q11?

Once again, from the resources that were given to us, and thanks to the process ID, we can easily find the answer by looking at the output of the ps command.

![img](/images/image017.png)

This somewhat raises suspicion because it's running under the daemon user, which is known for running background processes.

**Answer:** `daemon`

<br>

---

<br>

### Q14: Two suspicious shell processes were running from the tmp folder. What are their PIDs?

![img](/images/image018.png)

Again with the lsof command we can look for file descriptor values "cwd".

**Answer:** `15853, 21785`

<br>

---

<br>

### Q15: What is the MAC address of the captured memory?

This one is pretty straightforward at first, since the MAC address can be found using the `linux_ifconfig` plugin in volatility which gives info about the interfaces configured in the machine.

But first we need the right profile for volatility to work correctly. Briefly, a profile is a bunch of data which identifies a certain system and gives volatility information about how to deal with the raw data from the memory capture. It usually consists of 2 files:

- **"System.map"** which is a symbol table, where in one column you have variable and functions from the kernel that map to a second column that consists of their locations in the virtual memory.
- **"module.dwarf"** which gives information about the data structures layout used by the exact target OS (the data fields, their sizes, offsets ...)

The first file is usually found at `/boot/System.map-$(uname -r)` so we can find it quickly using autopsy.

![img](/images/image019.png)

The module.dwarf file though, we will need to build it from scratch using the linux headers of the exact build of the target OS.

Fortunately, the resources that were given to us contain info about the exact build version of our target machine:
```bash
$ cat uac/live_response/system/uname_-a.txt
Linux ApacheWebServer 5.4.0-1059-azure #62~18.04.1-Ubuntu SMP Tue Sep 14 17:53:18 UTC 2021 x86_64 x86_64 x86_64 GNU/Linux
```

To avoid any unnecessary headache we will download the tools we need in a docker container that's running an Ubuntu image with the same version as our target machine. The tools/data we'll need to install upon running the container are:

- linux-image-5.4.0-1059-azure
- linux-headers-5.4.0-1059-azure
- build-essential
- git
- nano
- dwarfdump
- the volatility framework

We'll need to tweak the Makefile file so that the module.dwarf file generated matches our target kernel. All we have to do is change the value of the KVER variable to the one you can see in the screen:

![img](/images/image020.png)

Then you can just run the `make` command and it gives you the module.dwarf file.

Afterwards we'll just need to compress the System.map and module.dwarf into a zip file, and put it in the right folder, which is `volatility/volatility/plugins/overlays/linux`.

We can now use our newly crafted profile in volatility.

![img](/images/image021.png)

**Answer:** `00:22:48:26:3b:16`

<br>

---

<br>

### Q16: Based on Bash history. The attacker downloaded the SH script. What is the name of the file?

A bash history can be quite useful in terms of relevant information. We'll take a look at it using the `linux_bash` plugin:
```bash
$ vol -f ubuntu.20211208.mem --profile=LinuxUbuntu18_04x64 linux_bash | egrep "wget|curl" | grep ".sh"
```

![img](/images/image022.png)

We can see 2 suspicious looking scripts: `wget.sh` and `unk.sh`.

The two IPs are somewhat suspicious after quick search in VirusTotal, unfortunately I couldn't find any further info to justify malicious intent.

**Answer:** `unk.sh`