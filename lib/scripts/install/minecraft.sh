#!/bin/bash

function checkResponseCode() {
    if [ $? -ne 0 ]; then
        echo -e "An error occurred while installing."
        exit 1
    fi
}

# Allows enough time for PufferPanel to get the Feed
sleep 5

username=root
base="/home/"
plugin="vanilla"
spigotVersion="latest"
spongeVersion="1.8-1519-2.1DEV-693"
forgeVersion="1.8-11.14.3.1519"
vanillaVersion="1.8.8"
useDocker="false";

while getopts ":b:u:r:s:f:p:v:d" opt; do
    case "$opt" in
    b)
        base=$OPTARG
        ;;
    u)
        username=$OPTARG
        ;;
    r)
        spigotVersion=$OPTARG
        ;;
    s)
        spongeVersion=$OPTARG
        ;;
    f)
        forgeVersion=$OPTARG
        ;;
    p)
        plugin=$OPTARG
        ;;
    v)
        vanillaVersion=$OPTARG
        ;;
    d)
        useDocker="true"
        ;;
    esac
done
base=${base}/

if [ "$username" == "root" ]; then
    echo "WARNING: Invalid Username Supplied."
    exit 1
fi;

if [ ! -d "${base}${username}/public" ]; then
    echo "The home directory for the user (${base}${username}/public) does not exist on the system."
    exit 1
fi;

cd ${base}${username}/public
checkResponseCode

echo "installer:~$ rm -rf *"
rm -rf *
checkResponseCode

if [ "$plugin" == "spigot" ]; then
    # version selection now is quite easy on spigot
    # https://www.spigotmc.org/wiki/buildtools/#versions
    echo "installer:~$ curl -o BuildTools.jar https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar"
    curl -o BuildTools.jar https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar
    checkResponseCode

    echo "installer:~$ git config --global --unset core.autocrlf"
    git config --global --unset core.autocrlf

    echo "installer:~$ java -jar BuildTools.jar --rev ${spigotVersion}"
    java -jar BuildTools.jar --rev ${spigotVersion}
    checkResponseCode

    echo "installer:~$ mv spigot*.jar ../server.jar"
    mv spigot*.jar ../server.jar
    checkResponseCode

    echo "installer:~$ rm -rf *"
    rm -rf *
    checkResponseCode

    echo "installer:~$ mv ../server.jar server.jar"
    mv ../server.jar server.jar
    checkResponseCode

elif [[ "$plugin" == "forge" || $plugin == "sponge-forge" ]]; then

    echo "installer:~$ curl -o MinecraftForgeInstaller.jar http://files.minecraftforge.net/maven/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-installer.jar"
    curl -o MinecraftForgeInstaller.jar http://files.minecraftforge.net/maven/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-installer.jar
    checkResponseCode

    echo "installer:~$ java -jar MinecraftForgeInstaller.jar --installServer"
    java -jar MinecraftForgeInstaller.jar --installServer
    checkResponseCode

    echo "installer:~$ mv forge-${forgeVersion}-universal.jar server.jar"
    mv forge-${forgeVersion}-universal.jar server.jar
    checkResponseCode

    echo "installer:~$ rm -f MinecraftForgeInstaller.jar"
    rm -f MinecraftForgeInstaller.jar
    checkResponseCode

    # Install Sponge Now
    if [ "$plugin" == "sponge-forge" ]; then

        echo "installer:~$ mkdir mods"
        mkdir -p mods
        checkResponseCode

        echo "installer:~$ cd mods"
        cd mods
        checkResponseCode

        echo "installer:~$ curl -o sponge-${spongeVersion}.jar http://repo.spongepowered.org/maven/org/spongepowered/sponge/${spongeVersion}/sponge-${spongeVersion}.jar"
        curl -o sponge-${spongeVersion}.jar http://repo.spongepowered.org/maven/org/spongepowered/sponge/${spongeVersion}/sponge-${spongeVersion}.jar
        checkResponseCode

    fi
elif [ "$plugin" == "sponge" ]; then
    echo 'Sponge Standalone is not currently supported in this version.';
elif [[ "$plugin" == "vanilla" ]]; then
    echo "installer:~$ curl -o server.jar https://s3.amazonaws.com/Minecraft.Download/versions/${vanillaVersion}/minecraft_server.${vanillaVersion}.jar"
    curl -o server.jar https://s3.amazonaws.com/Minecraft.Download/versions/${vanillaVersion}/minecraft_server.${vanillaVersion}.jar
    checkResponseCode
fi

echo "installer:~$ chown -R ${username}:scalesuser *"
chown -R ${username}:scalesuser *
checkResponseCode

echo "installer:~$ exit 0"
exit 0
